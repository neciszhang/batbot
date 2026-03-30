import os from "node:os";
import { join } from "node:path";

export const getConfigPath = (): string => {
  return join(os.homedir(), ".batbot", "config.json");
};

export const getWorkspacePath = (): string => {
  return join(os.homedir(), ".batbot", "workspace");
};
