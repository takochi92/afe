// 自動ロック：アラームが鳴ったら解錠状態（storage.session）を消す。ネットワーク通信はしない。
chrome.alarms.onAlarm.addListener(a => { if (a.name === 'autolock') chrome.storage.session.remove('unlock'); });
