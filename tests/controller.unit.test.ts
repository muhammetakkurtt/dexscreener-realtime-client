import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { StreamController } from '../src/cli/controller.js';
import { DexScreenerStream } from '../src/client.js';

describe('StreamController', () => {
  let mockStreams: DexScreenerStream[];
  let controller: StreamController;

  beforeEach(() => {
    // Create mock streams with start/stop methods
    mockStreams = [
      {
        start: vi.fn(),
        stop: vi.fn(),
        getState: vi.fn().mockReturnValue('disconnected'),
      } as unknown as DexScreenerStream,
      {
        start: vi.fn(),
        stop: vi.fn(),
        getState: vi.fn().mockReturnValue('disconnected'),
      } as unknown as DexScreenerStream,
    ];

    controller = new StreamController(mockStreams);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with unpaused state', () => {
      const state = controller.getState();
      expect(state.paused).toBe(false);
      expect(state.pausedAt).toBeUndefined();
      expect(state.resumedAt).toBeUndefined();
    });
  });

  describe('pause', () => {
    it('should stop all streams when paused', () => {
      controller.pause();

      expect(mockStreams[0].stop).toHaveBeenCalledTimes(1);
      expect(mockStreams[1].stop).toHaveBeenCalledTimes(1);
    });

    it('should update state to paused with timestamp', () => {
      const beforePause = Date.now();
      controller.pause();
      const afterPause = Date.now();

      const state = controller.getState();
      expect(state.paused).toBe(true);
      expect(state.pausedAt).toBeDefined();
      expect(state.pausedAt).toBeGreaterThanOrEqual(beforePause);
      expect(state.pausedAt).toBeLessThanOrEqual(afterPause);
      expect(state.resumedAt).toBeUndefined();
    });

    it('should not stop streams again if already paused', () => {
      controller.pause();
      controller.pause();

      // Should only be called once
      expect(mockStreams[0].stop).toHaveBeenCalledTimes(1);
      expect(mockStreams[1].stop).toHaveBeenCalledTimes(1);
    });
  });

  describe('resume', () => {
    it('should start all streams when resumed', () => {
      controller.pause();
      controller.resume();

      expect(mockStreams[0].start).toHaveBeenCalledTimes(1);
      expect(mockStreams[1].start).toHaveBeenCalledTimes(1);
    });

    it('should update state to unpaused with timestamp', () => {
      controller.pause();
      const pausedAt = controller.getState().pausedAt;

      const beforeResume = Date.now();
      controller.resume();
      const afterResume = Date.now();

      const state = controller.getState();
      expect(state.paused).toBe(false);
      expect(state.pausedAt).toBe(pausedAt); // Should preserve original pause time
      expect(state.resumedAt).toBeDefined();
      expect(state.resumedAt).toBeGreaterThanOrEqual(beforeResume);
      expect(state.resumedAt).toBeLessThanOrEqual(afterResume);
    });

    it('should not start streams if not paused', () => {
      controller.resume();

      // Should not be called since we never paused
      expect(mockStreams[0].start).not.toHaveBeenCalled();
      expect(mockStreams[1].start).not.toHaveBeenCalled();
    });
  });

  describe('getState', () => {
    it('should return a copy of the state', () => {
      const state1 = controller.getState();
      const state2 = controller.getState();

      expect(state1).toEqual(state2);
      expect(state1).not.toBe(state2); // Different objects
    });

    it('should track pause/resume cycle', () => {
      const initialState = controller.getState();
      expect(initialState.paused).toBe(false);

      controller.pause();
      const pausedState = controller.getState();
      expect(pausedState.paused).toBe(true);
      expect(pausedState.pausedAt).toBeDefined();

      controller.resume();
      const resumedState = controller.getState();
      expect(resumedState.paused).toBe(false);
      expect(resumedState.pausedAt).toBe(pausedState.pausedAt);
      expect(resumedState.resumedAt).toBeDefined();
    });
  });

  describe('setupSignalHandlers', () => {
    it('should setup signal handlers on Unix systems', () => {
      // Skip on Windows
      if (process.platform === 'win32') {
        controller.setupSignalHandlers();
        // No error should be thrown
        expect(true).toBe(true);
        return;
      }

      const processSpy = vi.spyOn(process, 'on');
      controller.setupSignalHandlers();

      expect(processSpy).toHaveBeenCalledWith('SIGUSR1', expect.any(Function));
      expect(processSpy).toHaveBeenCalledWith('SIGUSR2', expect.any(Function));
    });

    it('should pause streams on SIGUSR1', () => {
      // Skip on Windows
      if (process.platform === 'win32') {
        return;
      }

      let sigusr1Handler: Function | undefined;
      vi.spyOn(process, 'on').mockImplementation((event: any, handler: any) => {
        if (event === 'SIGUSR1') {
          sigusr1Handler = handler;
        }
        return process;
      });

      controller.setupSignalHandlers();
      expect(sigusr1Handler).toBeDefined();

      // Trigger the handler
      sigusr1Handler!();

      expect(mockStreams[0].stop).toHaveBeenCalledTimes(1);
      expect(mockStreams[1].stop).toHaveBeenCalledTimes(1);
      expect(controller.getState().paused).toBe(true);
    });

    it('should resume streams on SIGUSR2', () => {
      // Skip on Windows
      if (process.platform === 'win32') {
        return;
      }

      let sigusr1Handler: Function | undefined;
      let sigusr2Handler: Function | undefined;
      vi.spyOn(process, 'on').mockImplementation((event: any, handler: any) => {
        if (event === 'SIGUSR1') {
          sigusr1Handler = handler;
        } else if (event === 'SIGUSR2') {
          sigusr2Handler = handler;
        }
        return process;
      });

      controller.setupSignalHandlers();
      expect(sigusr1Handler).toBeDefined();
      expect(sigusr2Handler).toBeDefined();

      // First pause
      sigusr1Handler!();
      expect(controller.getState().paused).toBe(true);

      // Then resume
      sigusr2Handler!();

      expect(mockStreams[0].start).toHaveBeenCalledTimes(1);
      expect(mockStreams[1].start).toHaveBeenCalledTimes(1);
      expect(controller.getState().paused).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('should handle empty stream array', () => {
      const emptyController = new StreamController([]);
      
      emptyController.pause();
      expect(emptyController.getState().paused).toBe(true);

      emptyController.resume();
      expect(emptyController.getState().paused).toBe(false);
    });

    it('should handle multiple pause/resume cycles', () => {
      controller.pause();
      const firstPauseAt = controller.getState().pausedAt;

      controller.resume();
      const firstResumeAt = controller.getState().resumedAt;

      controller.pause();
      const secondPauseAt = controller.getState().pausedAt;

      controller.resume();
      const secondResumeAt = controller.getState().resumedAt;

      expect(secondPauseAt).toBeGreaterThanOrEqual(firstPauseAt!);
      expect(secondResumeAt).toBeGreaterThanOrEqual(firstResumeAt!);
    });
  });
});
