import { existsSync } from "fs";
import { BatBotCommand } from "./command";
import { VERSION, LOGO } from "./index";
import { getConfigPath } from "./config";
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
    logger.info("Initializing batbot configuration and workspace...");
    const configPath = getConfigPath();

    if (existsSync(configPath)) {
    }

    logger.info(`${LOGO} batbot is ready!`);
    logger.info(`\nNext steps:`);
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
