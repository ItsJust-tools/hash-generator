# Hash Generator

Generate cryptographic hashes and HMACs from text or files — entirely client-side and privacy-first.

**Live:** [hash-generator.itsjust.tools](https://hash-generator.itsjust.tools)

## Features

- Algorithms: MD5, SHA-1, SHA-256, SHA-384, SHA-512
- Hash arbitrary text with live updates as you type
- Hash uploaded files via drag-and-drop or a file picker
- HMAC support with a keyed secret input (all algorithms, MD5 via RFC 2104)
- Uppercase/lowercase output toggle and copy-to-clipboard for each hash
- Compare mode: paste an expected hash and get an instant match/no-match verdict
- Input size display (characters and UTF-8 bytes) and hashing duration in ms
- Shareable URL that encodes the text input in the fragment — never the HMAC secret

All hashing runs locally in your browser using the Web Crypto API (SHA family, HMAC) and a built-in MD5 implementation. Nothing is uploaded.

## Keyboard shortcuts

Use the toolbar and sidebar controls; shortcuts follow the tool shell conventions.

## Development

```bash
npm install
npm run build -w @itsjust/core   # build shared core first
npm run dev
npm test
```

## Deployment

```bash
docker build -t itsjust-hash-generator .
docker run -p 3000:3000 itsjust-hash-generator
```

## License

MIT
