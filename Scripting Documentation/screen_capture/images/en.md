# Screen Capture: Images

`session.nextFrame({timeoutMs?, signal?, image?})` waits for a new complete/started image received after the call. Default timeout is 5000 ms; 0 waits without a deadline. Only one helper read may be pending, including conversion. An individual read signal cancels that read without ending the session; the session's own signal controls its lifetime.

`latestFrame({maxAgeMs?, image?})` returns an eligible cached image or `null` immediately, without waiting. Default maximum age is 1000 ms, 0 permits only a current sample, and `Infinity` removes the age limit. Ages use monotonic native receive times. Stopping clears the cache; reading an ended session rejects `sessionEnded`.

An image result contains `image: UIImage`, native `timing`, `metadata`, source format and sequence. Images normalize orientation. `image.maxDimension` optionally scales down; no scaling limit is imposed by default. `image.dynamicRange` defaults to `preserve`; `sdr` explicitly tone maps for SDR consumers. Pass `frame.image` to existing image, OCR or barcode APIs. Raw output sampling has independent queues.

`capture({delayMs?, timeoutMs?, image?, ...sessionOptions})` is the convenience equivalent. `delayMs` starts after capture starts, and is interruptible by abort or system stop. For cross-app work, select full display and switch apps during the delay. Protected content and system restrictions still apply.

## index.tsx

Run it inside the main App; the system picker requires user interaction. The Stop / Cancel button and closing the script release its session.

Open the documentation’s example entry to run the demo, or view the complete [index.tsx](index.tsx).
