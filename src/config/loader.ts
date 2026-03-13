import path from "path";
import fs from "fs";
import { getConfigPath } from "./paths";
import { Config } from "./schema";

export const saveConfig = (config: Config, configPath?: string) => {
  const filePath = configPath || getConfigPath();
  const dir = path.dirname(filePath);

  if(!fs.existsSync(dir)){
    fs.mkdirSync(dir,{recursive:true});
  }

  fs.writeFileSync(filePath, JSON.stringify(config, null, 2), 'utf-8');
};
