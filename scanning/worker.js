const { spawn } = require('node:child_process');
const { createInterface } = require('node:readline');
const fs = require('node:fs');
const path = require('node:path');

class Scanner {
  constructor() { this.child = null; this.pending = new Map(); this.sequence = 0; }
  start() {
    if (this.child) return;
    const localPython = path.join(__dirname, '..', '.venv', ...(process.platform === 'win32' ? ['Scripts', 'python.exe'] : ['bin', 'python']));
    const python = process.env.SCANNER_PYTHON || (fs.existsSync(localPython) ? localPython : 'python3');
    const child = spawn(python, [path.join(__dirname, 'detector.py')], { stdio: ['pipe','pipe','pipe'] });
    this.child = child;
    child.stderr.on('data', () => {});
    child.stdin.on('error', () => {});
    const fail = () => {
      if (this.child !== child) return;
      this.child = null;
      for (const { reject, timer } of this.pending.values()) {
        clearTimeout(timer); reject(new Error('Automatic scanning is unavailable. Use manual alignment.'));
      }
      this.pending.clear();
    };
    child.on('error', fail);
    child.on('exit', fail);
    createInterface({ input: child.stdout }).on('line', line => {
      try {
        const message = JSON.parse(line);
        const request = this.pending.get(message.id);
        if (!request) return;
        this.pending.delete(message.id);
        clearTimeout(request.timer);
        if (message.error) request.reject(new Error(message.error));
        else request.resolve(message.result);
      } catch { fail(); child.kill(); }
    });
  }
  detect(image, species) {
    if (this.pending.size >= 8) return Promise.reject(new Error('Scanner busy. Try again in a moment.'));
    this.start();
    return new Promise((resolve, reject) => {
      const id = ++this.sequence;
      const timer = setTimeout(() => {
        const child = this.child;
        // A stuck native job blocks the worker queue, so restart it for all callers.
        if (child) child.kill('SIGKILL');
      }, 25000);
      this.pending.set(id, { resolve, reject, timer });
      this.child.stdin.write(`${JSON.stringify({id,image,species})}\n`);
    });
  }
  close() { if (this.child) this.child.kill(); }
}
module.exports = Scanner;
