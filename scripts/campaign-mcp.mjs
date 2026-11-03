/** Project-local MCP launcher; reuses the installed browser and pins the tool version. */
import {spawn} from 'node:child_process';
import {chromium} from 'playwright';
const child=spawn('npx',['--yes','@playwright/mcp@0.0.84','--headless','--no-sandbox','--executable-path',chromium.executablePath()],{stdio:'inherit'});
child.on('exit',code=>process.exit(code??1));
for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>child.kill(signal));
