import fs from 'fs'
import { resolve } from 'path'
import { performance } from 'perf_hooks'
import playwright from 'playwright'
import terminal from 'terminal-kit'
import shortid from 'shortid'
import { formatDistance } from 'date-fns'
import { createServer } from 'http-server'

const { terminal: term } = terminal
const indent = '  '
const testRunId = shortid.generate()
const resultsDir = resolve('.', 'results')

if (!fs.existsSync(resultsDir)) {
  fs.mkdirSync(resultsDir)
}

const args = process.argv.slice(2);

var sdkHost = '';
var singleTest = '';
var showPass = false;
var argIndex = 0;
var browsers = ['chromium', 'firefox', 'webkit'];
var toolkits = ['classic', 'modern'];

let separator = ',';

function validateValues(types, providedValues) {
    let validTypes = [];

    providedValues.forEach(function(value) {
      if (types.includes(value)) {
        validTypes.push(value);
      }
    });

    if (validTypes.length === 0) {
      validTypes = types;
    }

    return validTypes;
}

args.forEach(function(arg) {
  switch(arg) {
    case '-sdk-url':
      sdkHost = args[argIndex + 1];
    break;
    case '-single-test':
      singleTest = args[argIndex + 1];
    break;
    case '-show-pass':
      showPass = (args[argIndex + 1] === 'true');
    break;
    case '-browsers':
      browsers = validateValues(
          browsers,
          (args[argIndex + 1]).split(separator)
      );
      break;
    case '-toolkits':
      toolkits = validateValues(
          toolkits,
          (args[argIndex + 1]).split(separator)
      );
      break;  
  }
  argIndex++;
});

term.clear()
term.white.bold(`Running Unit tests in ${browsers.join(', ')} using ${toolkits.join(', ')}. ⚔️\n`)

const createMessageProcessor = (callback, { browser, showPassed, toolkit } = {}) => {
  const results = []
  const currentSuite = []
  let currentTest = {}
  let isSuitesFirstTest = true
  let lastTestStartTime
  const suffix = `(${toolkit}-${browser})`

  return (msg) => {
    const { type, name, message, plan, topSuite } = msg

    const suite = currentSuite.join(' / ')
    if (type === 'message') {
      term.white(`${suffix} ${msg.text}\n`)
    } else if (type === 'testStarted') {
      lastTestStartTime = performance.now()
      currentTest = { suite: Array.from(currentSuite), name, passed: true, browser, toolkit }

      if (showPassed && isSuitesFirstTest) {
        term.white(`📙 ${suite}\n`)
        isSuitesFirstTest = false
      }
      results.push(currentTest)
    } else if (type === 'testSuiteStarted') {
      currentSuite.push(name)
    } else if (type === 'testFinished') {
      const { passed, message: errorMessage } = currentTest
      const end = performance.now()
      const time = formatDistance(lastTestStartTime, end)

      currentTest = Object.assign(currentTest, { time })

      if (showPassed && passed) {
        term.white(indent).green(`✔️  Passed: ${name} ${suffix}\n`)
      } else if (!passed) {
        if (!showPassed && isSuitesFirstTest) {
          term.white(`📙 ${suite}\n`)
          isSuitesFirstTest = false
        }
        term.white(indent).red(`💣 Failed: ${name} ${suffix}\n`).white(indent).yellow(`${errorMessage}\n`)
      }
    } else if (type === 'testFailed') {
      Object.assign(currentTest, { passed: false, message })
    } else if (type === 'testSuiteFinished') {
      currentSuite.pop()
      isSuitesFirstTest = true
    } else if (type === 'testRunnerFinished') {
      callback(results)
    }
  }
}

const run = (engine, url, { launchSettings, processorSettings } = {}) => {
  return new Promise(async (resolve) => {
    const browser = await engine.launch(launchSettings)
    const context = await browser.newContext()
    const page = await context.newPage()
    const engineName = engine.name()

    const cb = async (results) => {
      await context.close()
      await browser.close()
      resolve(results)
    }
    const processor = createMessageProcessor(cb, { ...processorSettings, browser: engineName })

    await page.exposeFunction('report', (data) => {
      if (Array.isArray(data)) {
        data.forEach(processor)
      } else {
        processor(data)
      }
    })

    page.on('pageerror', (exception) => term.white(exception))
    page.on('console', (msg) => term.brightBlue(`${msg.text()}\n`))

    await page.goto(url)
    // await page.screenshot({ path: 'screenshot.png' });
  })
}

const getRunner = (browser, toolkit) => {
  return async () => {
    const engine = playwright[browser]
    const id = `${toolkit}-${browser}`
    
    let url = sdkHost + `/ext/${toolkit}/${toolkit}/test/local/?headless-test=true`;

    if (singleTest) {
      url += '&load=' + singleTest;
    }
    
    const start = performance.now()
    const results = await run(engine, url, {
      launchSettings: { headless: true },
      processorSettings: { showPassed: showPass, toolkit },
    })

    return { id, results, time: formatDistance(start, performance.now()) }
  }
}

const PORT = 1841
const server = createServer({ root: '../' })
server.listen(PORT)
term.green(`Server Listening on port ${PORT}\n`)

const testStartTime = performance.now()
let totalTestsRun = 0
let totalTestsFailed = 0

const allResults = await Promise.all(
  toolkits
    .map((toolkit) => browsers.map((browser) => [browser, toolkit]))
    .flat()
    .map(([browser, toolkit]) => getRunner(browser, toolkit))
    .map((runner) => runner())
)

const testEndTime = performance.now()

term.white('\n')
allResults.forEach(({ id, results, time }) => {
  const failed = results.filter((result) => !result.passed)
  const totalFailures = failed.length

  totalTestsRun += results.length

  if (results.length > 0) {
    term.bgWhite.black(`${results.length} test ran in ${time} on ${id}. `)

    if (totalFailures) {
      totalTestsFailed += totalFailures;
      fs.writeFileSync(resolve(resultsDir, `${testRunId}-${id}.json`), JSON.stringify(failed, 0, 2))
      term.bgWhite.red(`${totalFailures} failed.  👎\n`)
    } else {
      term.bgWhite.green('All Passed 💪\n')
    }
  }
})

term.bgBlue.white(`${totalTestsRun} tests ran in ${formatDistance(testStartTime, testEndTime)}. `)

if (totalTestsFailed) {
  term.bgBlue.red(`${totalTestsFailed} total failed tests. 👎`)
} else {
  term.bgBlue.green('All Passed 💪\n')
}

server.close()
