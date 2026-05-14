# Zadarma Direct Number Search

A Node.js script to search for available phone numbers in the Zadarma marketplace using their API. It allows you to filter by country, phone number mask, and other parameters.

## Install

Download the code and install dependencies.

```bash
git clone https://github.com/amochkin/zadarma-phone-search.git
cd zadarma-number-search
npm install
### or pnpm:
pnpm install
```

## Config

### API Keys 

Get API keys from Zadarma and set them as environment variables.

https://my.zadarma.com/marketplace/#tab-apiKeys

### Environment Variables

Store them in a `.env` file in root directory or export them in your shell.

```dotenv
ZADARMA_KEY=your_api_key
ZADARMA_SECRET=your_api_secret
```

## Usage

Run this script to search for available phone numbers in Zadarma.

```bash
pnpm exec tsx src/index.ts --country=GB --mask=207
```

### Command Line Arguments

| Argument                | Description                                                                                                                                         |                  Default |
|-------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------|-------------------------:|
| `--country=<ISO2>`      | Required country code for the Zadarma direct-number search, using ISO 3166-1 alpha-2 format. Example: `GB`, `US`, `DE`.                             |                 Required |
| `--mask=<value>`        | Optional phone number mask used to filter available numbers. Example: `207`.                                                                        |   Empty string / no mask |
| `--alpha-mask=<phrase>` | Optional vanity-style phrase converted to a numeric phone keypad mask. Example: `FLOWERS` becomes `3569377`. Cannot be used together with `--mask`. |   Empty string / no mask |
| `--language=<code>`     | Language used for direction names returned by Zadarma. Example: `en`.                                                                               |                     `en` |
| `--direction-id=<id>`   | Restricts the search to a single Zadarma direction/city ID instead of searching all directions in the country.                                      | Not set / all directions |
| `--verbose`             | Enables request-level debug logs, including request paths and response timing.                                                                      |                  `false` |
| `--exit-on-find`        | Stops searching after the first direction that returns one or more available numbers.                                                               |                  `false` |
| `--delay-ms=<number>`   | Adds a delay in milliseconds between direction availability requests to reduce request rate. Example: `1000`.                                       |                    `600` |

> Note: Zadarma API has rate limits = 100 requests per minute. Use `--delay-ms` to avoid hitting the limit when searching through many directions.