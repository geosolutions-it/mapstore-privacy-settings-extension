# Translations

Optional `data.<locale>.json` files that replace texts of the privacy settings panel of MapStore.
They contain only the messages to change, for example:

```json
{
  "locale": "en-US",
  "messages": {
    "privacySettings": {
      "required": "Authentication, security and your privacy settings. See the Cookie Policy for details."
    }
  }
}
```

The keys are the `privacySettings` messages of the MapStore translation files. Languages without a file keep the MapStore texts.
Only `data.<locale>.json` files are added to the zip.
