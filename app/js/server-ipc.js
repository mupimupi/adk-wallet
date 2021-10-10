const { ipcRenderer } = require("electron");
var ccurl = false;

//only load for light wallets
if (require("electron").remote.getGlobal("lightWallet")) {
  try {
    ccurl = require("./ccurl-interface");
  } catch (err) {
    ccurl = false;
    console.log(err);
  }
}

ipcRenderer.on("showNodeInfo", function () {
  if (typeof UI != "undefined") {
    if (!UI.initialConnection) {
      $(document).one("initialConnection", function () {
        UI.showNodeInfo(function (error, identifier, html) {
          if (!error) {
            ipcRenderer.send("showModal", identifier, html);
          }
        });
      });
    } else {
      UI.showNodeInfo(function (error, identifier, html) {
        if (!error) {
          ipcRenderer.send("showModal", identifier, html);
        }
      });
    }
  }
});

ipcRenderer.on("showPeers", function () {
  if (typeof UI != "undefined") {
    if (!UI.initialConnection) {
      $(document).one("initialConnection", function () {
        UI.showPeers(function (error, identifier, html) {
          if (!error) {
            ipcRenderer.send("showModal", identifier, html);
          }
        });
      });
    } else {
      UI.showPeers(function (error, identifier, html) {
        if (!error) {
          ipcRenderer.send("showModal", identifier, html);
        }
      });
    }
  }
});

ipcRenderer.on("showFAQ", function () {
  if (typeof UI != "undefined") {
    UI.openHelpMenu();
  }
});

ipcRenderer.on("showTerm", function () {
  if (typeof UI != "undefined") {
    UI.openTermMenu();
  }
});

ipcRenderer.on("setFocus", function (event, focus) {
  if (typeof UI != "undefined") {
    UI.hasFocus = focus;
  }
});

ipcRenderer.on("toggleStatusBar", function (event, show) {
  if (typeof UI != "undefined") {
    if (show) {
      UI.startStatusBarTracking();
    } else {
      UI.stopStatusBarTracking();
    }
  }
});

ipcRenderer.on("hideStatusBar", function () {
  if (typeof UI != "undefined") {
    UI.stopStatusBarTracking();
  }
});

ipcRenderer.on("notify", function (event, type, message, options) {
  if (typeof UI != "undefined") {
    UI.notify(type, message, options);
  }
});

ipcRenderer.on("handleURL", function (event, url) {
  if (typeof UI != "undefined") {
    UI.handleURL(url);
  }
});

ipcRenderer.on("openHelpMenu", function () {
  if (typeof UI != "undefined") {
    UI.openHelpMenu();
  }
});

ipcRenderer.on("shutdown", function () {
  if (typeof UI != "undefined") {
    UI.shutdown();
  }
});

ipcRenderer.on("addPeer", function (event, node) {
  UI.addPeer(node.add);
});

ipcRenderer.on("stopCcurl", function (event, callback) {
  console.log("in stopCcurl renderer");
  if (ccurl && connection.ccurlProvider) {
    console.log(
      "calling ccurlInterruptAndFinalize with " + connection.ccurlProvider
    );
    ccurl.ccurlInterruptAndFinalize(connection.ccurlProvider);
  }

  console.log("Calling relaunchApplication");
  ipcRenderer.send("relaunchApplication", true);
});

function _hoverAmountStart(amount) {
  ipcRenderer.send("hoverAmountStart", amount);
}

function _hoverAmountStop() {
  ipcRenderer.send("hoverAmountStop");
}

function _editNodeConfiguration() {
  ipcRenderer.send("editNodeConfiguration");
}

function _rendererIsReady() {
  ipcRenderer.send("rendererIsReady", process.pid);
}

function _relaunchApplication() {
  ipcRenderer.send("relaunchApplication");
}

function _updateStatusBar(data) {
  ipcRenderer.send("updateStatusBar", data);
}

function _updateAppInfo(data) {
  ipcRenderer.send("updateAppInfo", data);
}

/*
function _logUINotification(type, message) {
  ipcRenderer.send("logUINotification", type, message);
}
*/

process.once("loaded", function () {
  global.backendLoaded = true;
  global.updateStatusBar = _updateStatusBar;
  global.hoverAmountStart = _hoverAmountStart;
  global.hoverAmountStop = _hoverAmountStop;
  global.editNodeConfiguration = _editNodeConfiguration;
  global.rendererIsReady = _rendererIsReady;
  global.relaunchApplication = _relaunchApplication;
  global.updateAppInfo = _updateAppInfo;
  if (typeof ccurl != "undefined") {
    global.ccurl = ccurl;
  }
  //global.logUINotification = _logUINotification;
});
