import { join } from 'path';
import { BaseTask, ITaskOptions } from './Base';
import { TaskType, TaskEventType, NpmClient, TaskState } from '../enums';
import { runCommand, getNpmClient } from '../../util';
import rimraf from 'rimraf';

export class InstallTask extends BaseTask {
  constructor(opts: ITaskOptions) {
    super(opts);
    this.type = TaskType.INSTALL;
  }

  public async run(env: any = {}) {
    await super.run();
    // 执行删除的日志需要自己处理
    try {
      this.emit(TaskEventType.STD_OUT_DATA, 'Cleaning node_modules...\n');
      await this.cleanNodeModules();
      this.emit(TaskEventType.STD_OUT_DATA, 'Cleaning node_modules success.\n');
    } catch (e) {
      this.emit(TaskEventType.STD_OUT_DATA, 'Cleaning node_modules error\n');
      this.emit(TaskEventType.STD_OUT_DATA, e.message + '\n');
    }

    const script = this.getScript(env);
    this.emit(TaskEventType.STD_OUT_DATA, `Executing ${script}... \n`);
    this.proc = runCommand(script, {
      cwd: this.cwd,
      env: {
        ...process.env,
        ...this.getSpeedUpEnv(env.TAOBAO_SPEED_UP),
      },
    });

    this.handleChildProcess(this.proc);
  }

  public async cancel() {
    const { proc } = this;
    if (!proc) {
      return;
    }

    // 子任务执行结束
    if ([TaskState.FAIL, TaskState.SUCCESS].indexOf(this.state) > -1) {
      return;
    }

    this.state = TaskState.INIT;
    // 杀掉子进程
    proc.kill('SIGINT');
  }

  public async cleanNodeModules() {
    return new Promise((resolve, reject) => {
      const nodeModulePath = join(this.cwd, 'node_modules');
      rimraf(nodeModulePath, err => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  private getScript({ NPM_CLIENT }: any = {}): string {
    const client = this.getNpmClient(NPM_CLIENT);
    let script = '';
    switch (client) {
      case NpmClient.tnpm:
        script = 'tnpm install -d';
        break;
      case NpmClient.cnpm:
        script = 'cnpm install -d';
        break;
      case NpmClient.npm:
        script = 'npm install -d';
        break;
      case NpmClient.ayarn:
        script = 'ayarn';
        break;
      case NpmClient.yarn:
        script = 'yarn';
        break;
      case NpmClient.pnpm:
        script = 'pnpm';
        break;
    }
    return script;
  }

  private getNpmClient(client?: string): NpmClient {
    if (client) {
      return NpmClient[client];
    }
    return getNpmClient();
  }

  private getSpeedUpEnv(taobaoSpeedUp: boolean) {
    if (!taobaoSpeedUp) {
      return {};
    }
    const registry = 'https://registry.npm.taobao.org';
    const MIRROR_URL = 'https://npm.taobao.org/mirrors';
    return {
      NODEJS_ORG_MIRROR: `${MIRROR_URL}/node`,
      NVM_NODEJS_ORG_MIRROR: `${MIRROR_URL}/node`,
      NVM_IOJS_ORG_MIRROR: `${MIRROR_URL}/iojs`,
      PHANTOMJS_CDNURL: `${MIRROR_URL}/phantomjs`,
      CHROMEDRIVER_CDNURL: 'http://tnpm-hz.oss-cn-hangzhou.aliyuncs.com/dist/chromedriver',
      OPERADRIVER_CDNURL: `${MIRROR_URL}/operadriver`,
      ELECTRON_MIRROR: `${MIRROR_URL}/electron/`,
      SASS_BINARY_SITE: `${MIRROR_URL}/node-sass`,
      PUPPETEER_DOWNLOAD_HOST: MIRROR_URL,
      FLOW_BINARY_MIRROR: 'https://github.com/facebook/flow/releases/download/v',
      npm_config_registry: registry,
      yarn_registry: registry,
    };
  }
}