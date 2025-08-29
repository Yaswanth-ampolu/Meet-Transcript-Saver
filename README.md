# 📝 Meet Transcript Saver - Chrome Extension

A powerful Chrome extension that automatically captures and saves Google Meet transcripts in multiple formats. Never lose important meeting notes again!

## ✨ Features

- **Automatic Capture**: Automatically detects and captures Google Meet captions/transcripts
- **Multiple Export Formats**: Save transcripts as TXT, JSON, CSV, or HTML
- **Real-time Status**: Live status updates showing capture progress
- **Keyboard Shortcuts**: Quick access with keyboard shortcuts
- **Persistent Storage**: Transcripts are saved even if you refresh the page
- **Modern UI**: Beautiful, intuitive popup interface
- **Meeting Detection**: Automatically detects meeting titles and timestamps

## 🚀 Installation

### Method 1: Load as Unpacked Extension (Recommended for Development)

1. **Download/Clone** this repository to your computer
2. **Open Chrome** and navigate to `chrome://extensions/`
3. **Enable Developer Mode** by toggling the switch in the top-right corner
4. **Click "Load unpacked"** and select the folder containing the extension files
5. **Pin the extension** to your toolbar for easy access

### Method 2: Manual Installation

1. Create a new folder called `meet-transcript/`
2. Copy all the files (`manifest.json`, `content.js`, `popup.html`, `popup.js`) into this folder
3. Follow steps 2-5 from Method 1

## 📖 How to Use

### Basic Usage

1. **Join a Google Meet** meeting
2. **Enable captions** in Google Meet (CC button)
3. **Open the extension** by clicking its icon in the toolbar
4. The extension will **automatically start capturing** captions
5. **Export** your transcript in your preferred format when ready

### Export Options

| Format | Description | Best For |
|--------|-------------|----------|
| 📄 **TXT** | Plain text file | Simple notes, sharing |
| 🔧 **JSON** | Structured data | Data processing, APIs |
| 📊 **CSV** | Spreadsheet format | Analysis, Excel |
| 🌐 **HTML** | Formatted web page | Viewing, presentations |

### Keyboard Shortcuts

- **Ctrl+Shift+S**: Save transcript as TXT
- **Ctrl+Shift+T**: Toggle capture on/off
- **Ctrl+Shift+C**: Clear current transcript

## 🎛️ Extension Interface

The popup interface shows:

- **Status**: Current capture state (Capturing/Stopped)
- **Lines Captured**: Number of transcript lines collected
- **Meeting**: Detected meeting name
- **Export Buttons**: Quick access to all export formats
- **Control Buttons**: Start/Stop capture and clear transcript

## 🔧 Technical Details

### How It Works

1. **Content Script** (`content.js`) runs on Google Meet pages
2. **Monitors** the captions container using MutationObserver
3. **Captures** new caption text as it appears
4. **Stores** transcript data in Chrome's local storage
5. **Communicates** with popup via Chrome messaging API

### Supported Google Meet Features

- Live captions/transcripts
- Multiple caption container selectors for reliability
- Meeting title detection
- Automatic retry if captions aren't immediately available

### File Structure

```
meet-transcript/
├── manifest.json       # Extension configuration
├── content.js         # Main capture logic
├── popup.html         # Extension popup interface
├── popup.js           # Popup functionality
└── README.md          # This file
```

## 🐛 Troubleshooting

### Extension Not Working?

1. **Check captions are enabled** in Google Meet (CC button)
2. **Refresh** the Google Meet page
3. **Restart** the extension by toggling it off/on in `chrome://extensions/`
4. **Check console** (F12) for any error messages

### No Transcript Data?

1. **Ensure captions are active** in the meeting
2. **Wait a few seconds** for the extension to detect the captions container
3. **Try toggling** capture off and on using the popup button
4. **Check** if other participants have enabled captions

### Export Not Working?

1. **Check** that you have transcript data (Lines Captured > 0)
2. **Try different export formats** to isolate the issue
3. **Ensure** your browser allows downloads from extensions

## 🔒 Privacy & Permissions

### Required Permissions

- **activeTab**: Access to current Google Meet tab
- **scripting**: Execute content script on Meet pages
- **storage**: Save transcript data locally
- **downloads**: Save exported files
- **host_permissions**: Access to meet.google.com

### Data Handling

- **Local Storage Only**: All data stays on your device
- **No External Servers**: No data sent to third parties
- **Temporary Storage**: Data cleared when extension is removed

## 🚀 Advanced Usage

### Customizing Export Formats

The extension supports multiple export formats. Each format includes:

- **Meeting title** and **timestamp**
- **Full transcript** with proper formatting
- **Metadata** (line count, date, etc.)

### Batch Processing

For multiple meetings:

1. **Clear transcript** after each meeting
2. **Export** before joining the next meeting
3. **Use descriptive meeting titles** for better organization

## 🤝 Contributing

Feel free to:

- **Report bugs** or issues
- **Suggest new features**
- **Submit pull requests**
- **Improve documentation**

## 📄 License

This project is open source and available under the MIT License.

## 🆘 Support

If you encounter any issues:

1. **Check** this README for troubleshooting steps
2. **Review** the browser console for error messages
3. **Try** disabling and re-enabling the extension
4. **Ensure** you're using the latest version of Chrome

---

**Happy Meeting! 🎉** Never lose important meeting insights again with Meet Transcript Saver! 