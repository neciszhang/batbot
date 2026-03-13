import os from "os";
import { join } from "path";

export const getConfigPath = (): string => {
  return join(os.homedir(), ".batbot", "config.json");
};

export const getWorkspacePath = (): string => {
  return join(os.homedir(), ".batbot", "workspace");
};
