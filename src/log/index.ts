import chalk from 'chalk';

const log = console.log;

const logger = {
  info: (message: string, ...args: unknown[]) => {
    log(chalk.blue('ℹ'), chalk.white(message), ...args);
  },

  success: (message: string, ...args: unknown[]) => {
    log(chalk.green('✔'), chalk.green(message), ...args);
  },

  warn: (message: string, ...args: unknown[]) => {
    log(chalk.yellow('⚠'), chalk.yellow(message), ...args);
  },

  error: (message: string, ...args: unknown[]) => {
    log(chalk.red('✖'), chalk.red(message), ...args);
  },

  debug: (message: string, ...args: unknown[]) => {
    log(chalk.gray('🐛'), chalk.gray(message), ...args);
  },

  title: (message: string) => {
    log(chalk.bold.cyan('\n' + message));
  },

  divider: () => {
    log(chalk.gray('─'.repeat(50)));
  },
};

export { log, logger };
export default logger;

