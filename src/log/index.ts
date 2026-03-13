import chalk from 'chalk';

const log = console.log;

const logger = {
  info: (message: string, ...args: (string | number | boolean)[]) => {
    const formatted = args.length > 0 ? message.replace(/%s/g, () => String(args.shift())) : message;
    log(chalk.blue('ℹ'), chalk.white(formatted));
  },

  success: (message: string, ...args: (string | number | boolean)[]) => {
    const formatted = args.length > 0 ? message.replace(/%s/g, () => String(args.shift())) : message;
    log(chalk.green('✔'), chalk.green(formatted));
  },

  warn: (message: string, ...args: (string | number | boolean)[]) => {
    const formatted = args.length > 0 ? message.replace(/%s/g, () => String(args.shift())) : message;
    log(chalk.yellow('⚠'), chalk.yellow(formatted));
  },

  error: (message: string, ...args: (string | number | boolean)[]) => {
    const formatted = args.length > 0 ? message.replace(/%s/g, () => String(args.shift())) : message;
    log(chalk.red('✖'), chalk.red(formatted));
  },

  debug: (message: string, ...args: (string | number | boolean)[]) => {
    const formatted = args.length > 0 ? message.replace(/%s/g, () => String(args.shift())) : message;
    log(chalk.gray('🐛'), chalk.gray(formatted));
  },

  title: (message: string) => {
    log(chalk.bold.cyan('\n' + message));
  },

  divider: () => {
    log(chalk.gray('─'.repeat(50)));
  },

  chalk,
};

export { log, logger };
export default logger;

