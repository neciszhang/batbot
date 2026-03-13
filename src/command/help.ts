import stripAnsi from 'strip-ansi';
import wrapAnsi from 'wrap-ansi';
import { Help } from "commander";
import chalk, { ChalkInstance } from "chalk";

class BatHelp extends Help {
  private chalkInstance: ChalkInstance;

  constructor() {
    super();
    this.chalkInstance = chalk;
  }

  prepareContext(contextOptions: {
    error?: boolean;
    helpWidth?: number;
    outputHasColors?: boolean;
  }): void {
    super.prepareContext(contextOptions);
    if (contextOptions?.error) {
      this.chalkInstance = chalk;
    }
  }

  displayWidth(str: string): number {
    return stripAnsi(str).length;
  }

  boxWrap(str: string, width: number): string {
    return wrapAnsi(str, width, { hard: true });
  }

  styleTitle(str: string): string {
    return this.chalkInstance.bold(str);
  }
  styleCommandText(str: string): string {
    return this.chalkInstance.cyan(str);
  }
  styleCommandDescription(str: string): string {
    return this.chalkInstance.magenta(str);
  }
  styleDescriptionText(str: string): string {
    return this.chalkInstance.italic(str);
  }
  styleOptionText(str: string): string {
    return this.chalkInstance.green(str);
  }
  styleArgumentText(str: string): string {
    return this.chalkInstance.yellow(str);
  }
  styleSubcommandText(str: string): string {
    return this.chalkInstance.blue(str);
  }
}

export { BatHelp };
