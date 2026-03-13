import { existsSync } from "fs";
import chalk from "chalk";
import { BatBotCommand } from "./command";
import { VERSION, LOGO } from "./index";
import {
  getConfigPath,
  getWorkspacePath,
  saveConfig,
  ConfigSchema,
} from "./config";
import { logger } from "./log";

const program = new BatBotCommand();

program
  .name("batbot")
  .description(`${LOGO} batbot - Personal AI Assistant`)
  .version(VERSION, "-v, --version", "output the version number");

program
  .command("onboard")
  .description("Initialize batbot configuration and workspace.")
  .action(() => {
    const configPath = getConfigPath();
    const workspacePath = getWorkspacePath();

    const config = ConfigSchema.parse(undefined);

    if (existsSync(configPath)) {
    } else {
      saveConfig(config, configPath);
    }

    if (!existsSync(workspacePath)) {
      logger.info(`Creating workspace directory: ${workspacePath}`);
    }

    logger.info(`${LOGO} batbot is ready!`);
    logger.info(`\nNext steps:`);
    logger.info(`  1. Add your API key to ${chalk.cyan(configPath)}`);
    logger.info(`     Get one at: https://openrouter.ai/keys`);
    logger.info(`  2. Chat: ${chalk.cyan('batbot agent -m "Hello!"')}`);
    logger.info(
      `\n${chalk.dim("Want Telegram/WhatsApp? See: https://github.com/neciszhang/batbot#-chat-apps")}`,
    );
  });

program
  .command("gateway")
  .description("Start the batbot gateway.")
  .action(() => {
    console.log("Starting batbot gateway...");
  });

program
  .command("agent")
  .description("Interact with the agent directly.")
  .action(() => {
    console.log("Interacting with agent...");
  });

program
  .command("status")
  .description("Show batbot status.")
  .action(() => {
    console.log("Showing batbot status...");
  });

program
  .command("channels")
  .description("Manage channels.")
  .action(() => {
    console.log("Managing channels...");
  });

program
  .command("provider")
  .description("Manage providers.")
  .action(() => {
    console.log("Managing providers...");
  });

program.parse();
