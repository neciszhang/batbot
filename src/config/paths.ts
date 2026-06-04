import os from "node:os";
import { join } from "node:path";

let _current_config_path: string | null = null;

/**
 * Set the current config path (used to derive data directory).
 * @param path The path to the config file.
 */
export const setConfigPath = (path: string) => {
  _current_config_path = path;
};

export const getConfigPath = (): string => {
  if (_current_config_path) return _current_config_path;
  return join(os.homedir(), ".batbot", "config.json");
};

export const getWorkspacePath = (): string => {
  return join(os.homedir(), ".batbot", "workspace");
};
