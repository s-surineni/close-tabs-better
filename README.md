This is a [Plasmo extension](https://docs.plasmo.com/) project bootstrapped with [`plasmo init`](https://www.npmjs.com/package/plasmo).

## Getting Started

First, run the development server:

```bash
pnpm dev
# or
npm run dev
```

Open your browser and load the appropriate development build. For example, if you are developing for the chrome browser, using manifest v3, use: `build/chrome-mv3-dev`.

You can start editing the popup by modifying `popup.tsx`. It should auto-update as you make changes. To add an options page, simply add a `options.tsx` file to the root of the project, with a react component default exported. Likewise to add a content page, add a `content.ts` file to the root of the project, importing some module and do some logic, then reload the extension on your browser.

For further guidance, [visit our Documentation](https://docs.plasmo.com/)

## Making production build

Run the following:

```bash
pnpm build
# or
npm run build
```

This should create a production bundle for your extension, ready to be zipped and published to the stores.

## Testing

This project uses [Vitest](https://vitest.dev/) for unit testing with [sinon-chrome](https://github.com/acvetkov/sinon-chrome) for mocking Chrome APIs.

### Running Tests

```bash
# Run tests once
pnpm test
# or
npm run test

# Run tests in watch mode
pnpm test:watch
# or
npm run test:watch

# Run tests with coverage
pnpm test:coverage
# or
npm run test:coverage
```

### Test Structure

- `background.test.js` - Unit tests for multi-window tab management logic
- `background.integration.test.js` - Integration tests for real-world multi-window scenarios
- `test/setup.js` - Test setup and Chrome API mocking configuration

### Test Coverage

The test suite covers:
- Active tab tracking per window
- Preventing closure of active tabs in any window
- Cleanup on tab/window removal
- Initialization on startup
- Edge cases and complex multi-window scenarios

## Submit to the webstores

The easiest way to deploy your Plasmo extension is to use the built-in [bpp](https://bpp.browser.market) GitHub action. Prior to using this action however, make sure to build your extension and upload the first version to the store to establish the basic credentials. Then, simply follow [this setup instruction](https://docs.plasmo.com/framework/workflows/submit) and you should be on your way for automated submission!
