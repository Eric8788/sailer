import type { ControlState } from '../types';

export interface KeyboardController {
  getControlState(): ControlState;
  destroy(): void;
}

export function createKeyboardController(): KeyboardController {
  const keys: Record<string, boolean> = {};

  const handleKeyDown = (event: KeyboardEvent) => {
    keys[event.key.toLowerCase()] = true;
  };

  const handleKeyUp = (event: KeyboardEvent) => {
    keys[event.key.toLowerCase()] = false;
  };

  window.addEventListener('keydown', handleKeyDown);
  window.addEventListener('keyup', handleKeyUp);

  return {
    getControlState() {
      return {
        turnLeft: Boolean(keys.a),
        turnRight: Boolean(keys.d),
        trimIn: Boolean(keys.arrowdown),
        easeOut: Boolean(keys.arrowup),
        crewLeft: Boolean(keys.arrowleft),
        crewRight: Boolean(keys.arrowright),
        boardDown: Boolean(keys.s),
        boardUp: Boolean(keys.w),
      };
    },
    destroy() {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    },
  };
}
