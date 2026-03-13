import { Command } from "commander";
import { BatHelp } from "./help";

// 自定义 Command 类，使用 BatHelp
class BatBotCommand extends Command {
  createCommand(name: string): Command {
    return new BatBotCommand(name);
  }

  createHelp(): BatHelp {
    return Object.assign(new BatHelp(), this.configureHelp());
  }
}

export { BatBotCommand };
