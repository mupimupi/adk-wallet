const { remote, webFrame, ipcRenderer, shell } = require("electron");


var __entityMap = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
  "/": "&#x2F;",
};

String.prototype.escapeHTML = function () {
  return String(this).replace(/[&<>"'\/]/g, function (s) {
    return __entityMap[s];
  });
};

var UI = (function (UI, undefined) {
  var showQuitAlert = false;
  var isInitialized = false;
  var callNodeStarted = false;
  var serverLogLines = 0;
  var webviewIsLoaded = false;
  var lightWallet = false;
  var webview;

  UI.initialize = function () {
    isInitialized = true;

    var showStatusBar = false;
    var isFirstRun = false;

    if (typeof URLSearchParams != "undefined") {
      var params = new URLSearchParams(location.search.slice(1));
      showStatusBar = params.get("showStatus") == 1;
      isFirstRun = params.get("isFirstRun") == 1;
      lightWallet = parseInt(params.get("lightWallet"), 10) == 1;
    }

    if (isFirstRun) {
      document.body.className = "new-user-active";
    } else if (showStatusBar) {
      document.body.className = "status-bar-active";
    } else {
      document.body.className = "";
    }

    webFrame.setVisualZoomLevelLimits(1, 1);
    ipcRenderer.send("rendererIsInitialized");
    if (callNodeStarted) {
      UI.nodeStarted(callNodeStarted);
      callNodeStarted = false;
    }

    if (!lightWallet) {
      document.body.className += " full-node";
      document
        .getElementById("status-bar-milestone")
        .addEventListener("click", function (e) {
          ipcRenderer.send("showServerLog");
        });

      document
        .getElementById("status-bar-solid-milestone")
        .addEventListener("click", function (e) {
          ipcRenderer.send("showServerLog");
        });
    }
  };

  UI.showContextMenu = function (e) {
    const template = [
      {
        label: "Cut",
        accelerator: "CmdOrCtrl+X",
        role: "cut",
      },
      {
        label: "Copy",
        accelerator: "CmdOrCtrl+C",
        role: "copy",
      },
      {
        label: "Paste",
        accelerator: "CmdOrCtrl+V",
        role: "paste",
      },
    ];

    if (remote.getCurrentWindow().isFullScreen()) {
      template.push({
        label: "Exit Fullscreen",
        accelerator: process.platform === "darwin" ? "Ctrl+Command+F" : "F11",
        click: function () {
          remote.getCurrentWindow().setFullScreen(false);
        },
      });
    }

    const menu = remote.Menu.buildFromTemplate(template);
    menu.popup(remote.getCurrentWindow(), e.x, e.y);
  };

  UI.nodeStarted = function (url, settings) {
    url =
      url +
      "?" +
      Object.keys(settings)
        .map(function (key) {
          return (
            encodeURIComponent(key) + "=" + encodeURIComponent(settings[key])
          );
        })
        .join("&");

    if (!isInitialized) {
      callNodeStarted = url;
      return;
    }

    webview = document.getElementById("server");
    webviewIsLoaded = false;

    const loadPage = () => {
      webview.loadURL(url);
      webview.removeEventListener("dom-ready", loadPage);
    };

    webview.addEventListener("dom-ready", loadPage);

    // Prevent window from redirecting to dragged link location (mac)
    webview.addEventListener(
      "dragover",
      function (e) {
        e.preventDefault();
        return false;
      },
      false
    );

    //also "dom-ready"
    webview.addEventListener("did-finish-load", UI.webviewDidFinishLoad());

    //sometimes did-finish-load does not fire..
    setTimeout(UI.webviewDidFinishLoad, 1000);

    webview.addEventListener("new-window", function (e) {
      shell.openExternal(e.url);
    });
  };

  UI.webviewDidFinishLoad = function () {
    //for some reason this is sometimes called 2 times?..
    if (webviewIsLoaded) {
      return;
    }

    // if (remote.getGlobal("hasOtherWin")) {
    //   return;
    // }

    if (webview.style.display == "none") {
      webview.style.display = "";
    }

    webviewIsLoaded = true;

    const remoteContent = remote.webContents.fromId(webview.getWebContentsId());

    remoteContent.addListener("context-menu", function (e) {
      e.preventDefault();
      UI.showContextMenu(e);
      // e.stopPropagation();
    });

    setTimeout(function () {
      remote.getCurrentWindow().show();
      webview.focus();
      //ipcRenderer.send("rendererIsReady");
    }, 250);

    try {
      remoteContent.document.body.addEventListener(
        "contextmenu",
        UI.showContextMenu,
        false
      );
    } catch (err) {}
  };

  // https://github.com/electron/electron/issues/5900
  UI.focusOnWebview = function () {
    if (webviewIsLoaded && webview) {
      webview.focus();
    }
  };

  UI.showServerLog = function (serverOutput) {
    if (showQuitAlert) {
      return;
    }
    UI.hideAlerts();

    serverLogLines = serverOutput.length;
    var log = serverOutput.join("\n");

    log = log.replace(/\n\s*\n/g, "\n");

    UI.showAlert(
      "<h1>Server Log</h1><p>Below are the last messages from the server log (<a href='#' id='copy_server_log'>copy</a>):</p>" +
        "<textarea rows='10' class='form-control' id='server_output' style='background:#000;color:#fff;font-family:courier;' readonly>" +
        String(log).escapeHTML() +
        "</textarea>",
      function () {
        document
          .getElementById("copy_server_log")
          .addEventListener("click", function (e) {
            e.preventDefault();
            e.stopPropagation();
            UI.copyServerLog();
          });
      },
      function () {
        ipcRenderer.send("stopLookingAtServerLog");
      }
    );

    document.getElementById(
      "server_output"
    ).scrollTop = document.getElementById("server_output").scrollHeight;
  };

  UI.copyServerLog = function () {
    document.getElementById("server_output").select();
    document.execCommand("copy");
    window.getSelection().removeAllRanges();
  };

  UI.appendToServerLog = function (data) {
    var serverLog = document.getElementById("server_output");

    if (serverLog) {
      serverLogLines++;
      if (serverLogLines > 5000) {
        var lines = serverLog.value.split(/\n/);
        lines = lines.slice(lines.length - 1001, lines.length - 1);
        serverLog.value = lines.join("\n");
        serverLogLines = 1000;
      }
      serverLog.value += data;
      if (
        serverLog.scrollHeight -
          (serverLog.scrollTop + serverLog.offsetHeight) <
        100
      ) {
        serverLog.scrollTop = serverLog.scrollHeight;
      }
    }
  };

  UI.toggleStatusBar = function (show) {
    document.body.className = show ? "status-bar-active" : "";
    if (webviewIsLoaded && webview) {
      webview.send("toggleStatusBar", show);
    }
  };

  UI.updateStatusBar = function (data) {
    if (data.hasOwnProperty("latestSolidSubmeshMilestoneIndex")) {
      document.getElementById("status-bar-solid-milestone").innerHTML = String(
        data.latestSolidSubmeshMilestoneIndex
      ).escapeHTML();
    }
    if (data.hasOwnProperty("latestMilestoneIndex")) {
      document.getElementById("status-bar-milestone").innerHTML = String(
        data.latestMilestoneIndex
      ).escapeHTML();
    }

    if (data.hasOwnProperty("cpu")) {
      if (data.cpu === "") {
        document.getElementById("status-bar-cpu").innerHTML = "";
      } else {
        document.getElementById("status-bar-cpu").innerHTML =
          "CPU: " + String(data.cpu).escapeHTML() + "%";
      }
    }

    if (document.getElementById("status-bar-dot-1").style.display == "none") {
      if (
        document.getElementById("status-bar-milestone").innerHTML &&
        document.getElementById("status-bar-solid-milestone").innerHTML
      ) {
        document.getElementById("status-bar-dot-1").style.display = "inline";
      }
    }
    if (document.getElementById("status-bar-dot-2").style.display == "none") {
      if (
        (document.getElementById("status-bar-milestone").innerHTML ||
          document.getElementById("status-bar-solid-milestone").innerHTML) &&
        document.getElementById("status-bar-cpu").innerHTML
      ) {
        document.getElementById("status-bar-dot-2").style.display = "inline";
      }
    }

    if (data.hasOwnProperty("hoverAmount")) {
      if (data.hoverAmount == -1) {
        document.getElementById("status-bar-aidos").style.display = "none";
      } else {
        document.getElementById("status-bar-aidos").style.display = "inline";
        document.getElementById(
          "status-bar-aidos"
        ).innerHTML = UI.convertToAidos(data.hoverAmount);
      }
    }
  };

  UI.convertToAidos = function (amount) {
    if (isNaN(amount)) {
      return "";
    }

    var negative = "";

    if (amount < 0) {
      amount = Math.abs(amount);
      negative = "-";
    }

    formattedAmount = negative + amount + " ADK";

    return formattedAmount;
  };

  UI.showPreferences = function (settings) {
    UI.hideAlerts();
    var modal = new tingle.modal({
      footer: true,
      onOpen: function () {
        var close = document.querySelector(".tingle-modal__close");
        var modalContent = document.querySelector(".tingle-modal-box__content");
        modalContent.appendChild(close);
      },
    });

    /*
    modal.setContent("<h1>Preferences</h1>" +
                     "<select name='auto_update_time' id='auto_update_time' style='width:100%'>" +
                     "<option value='1'" + (checkForUpdatesOption == "1" ? " selected='selected'" : "") + ">Check for Updates on Application Start</option>" +
                     "<option value='2'" + (checkForUpdatesOption == "2" ? " selected='selected'" : "") + ">Check for updates daily</option>" +
                     "<option value='3'" + (checkForUpdatesOption == "3" ? " selected='selected'" : "") + ">Check for updates weekly</option>" +
                     "<option value='0'" + (checkForUpdatesOption == "0" ? " selected='selected'" : "") + ">Never check for updates</option>" +
                     "</select>");
    */

    modal.setContent(
      "<h1>Preferences</h1>" +
        (process.platform != "linux"
          ? "<div class='input-group input-group-last'><label class='label--checkbox'><input type='checkbox' name='open_at_login' id='preferences_open_at_login' class='checkbox' value='1'" +
            (settings.openAtLogin ? " checked='checked'" : "") +
            " />Open at Login</label>"
          : "")
    );

    modal.addFooterBtn("Save", "tingle-btn tingle-btn--primary", function () {
      var settings = {};

      if (process.platform != "linux") {
        settings.openAtLogin = document.getElementById(
          "preferences_open_at_login"
        ).checked;
      }

      /*
      var autoUpdateTimeSelect = document.getElementById("auto_update_time");
      var checkForUpdatesOption = autoUpdateTimeSelect.options[autoUpdateTimeSelect.selectedIndex].value;
      */

      modal.close();
      ipcRenderer.send("updatePreferences", settings);
    });

    modal.open();
  };

  UI.addPeerNode = function (node) {
    if (showQuitAlert) {
      return;
    }
    UI.hideAlerts();

    var modal = new tingle.modal({
      footer: true,
      onOpen: function () {
        var close = document.querySelector(".tingle-modal__close");
        var modalContent = document.querySelector(".tingle-modal-box__content");
        modalContent.appendChild(close);
      },
    });

    modal.setContent(
      "<h1>Add Peer</h1>" +
        "<p>Are you sure you want to add this Peer to your server configuration?</p>" +
        "<p style='font-weight:bold'>" +
        String(node).escapeHTML() +
        "</p>"
    );

    modal.addFooterBtn(
      "Yes, Add This Peer",
      "tingle-btn tingle-btn--primary",
      function () {
        modal.close();
        ipcRenderer.send("addPeerNode", node);
      }
    );

    modal.addFooterBtn(
      "No, Cancel",
      "tingle-btn tingle-btn--default",
      function () {
        modal.close();
      }
    );

    modal.open();
  };

  UI.editNodeConfiguration = function (configuration) {
    if (showQuitAlert) {
      return;
    }
    UI.hideAlerts();

    var modal = new tingle.modal({
      footer: false,
      closeMethods: ["overlay", "escape"],
      cssClass: ["server-address"],
      onOpen: function () {
        var el = document.getElementById(
          configuration.lightWallet
            ? "server_config_host"
            : "server_config_port"
        );

        var temp = el.value;
        el.value = "";
        el.value = temp;
        el.focus();
      },
    });

    var content = "";
    if (configuration.lightWallet) {
      var host = "78.47.144.254";
      var server_scan_addresses = configuration.server_scan_addresses

      if (typeof server_scan_addresses == 'undefined'){
         server_scan_addresses = 10;
      }

      if (configuration.lightWalletHost) {
        host = configuration.lightWalletHost.match(/^https?:\/\/(.*)$/i);
        if (host && host.length > 0) {
          host = host[1];
        }
      }
      content = `<div class="flex flex-wrap h-full bg-cultured rounded-xl shadow-lg">
      <div class="w-full">
        <div class="px-6 flex flex-wrap items-center justify-between h-24 rounded-tl-xl rounded-tr-xl bg-dr-white">
          <div class="flex items-center flex-shrink-0">
            <button type="button" class="rounded-full bg-gainsboro opacity-50 text-silver text-3xl p-2" id="modal-close">
              <img
                src="ui/images/close.svg"
                alt=""
              />
            </button>
          </div>
          <div class="flex flex-grow items-center w-auto">
            <div class="flex-grow text-center">
              <h2 class="font-medium text-3xl">Server Address</h2>
            </div>
          </div>
        </div>
      </div>
      <div class="w-full p-8 content">
        <p class="text-lg pl-3 pb-2">Enter Address:</p>
        <p><input class="bg-white rounded-lg py-3 px-4 w-full" maxlength="32" type="text" id="server_config_host" placeholder="78.47.144.254" value="${host}" /></p>
        <button type="submit" class="block mx-auto mt-6 bg-dark-green text-white rounded-lg text-white text-lg px-16 py-3" id="server-btn">Ok</button>
      </div>
    </div>`;
  //   content = `<div class="flex flex-wrap h-full bg-cultured rounded-xl shadow-lg">
  //   <div class="w-full">
  //     <div class="px-6 flex flex-wrap items-center justify-between h-24 rounded-tl-xl rounded-tr-xl bg-dr-white">
  //       <div class="flex items-center flex-shrink-0">
  //         <button type="button" class="rounded-full bg-gainsboro opacity-50 text-silver text-3xl p-2" id="modal-close">
  //           <img
  //             src="ui/images/close.svg"
  //             alt=""
  //           />
  //         </button>
  //       </div>
  //       <div class="flex flex-grow items-center w-auto">
  //         <div class="flex-grow text-center">
  //           <h2 class="font-medium text-3xl">Server Address</h2>
  //         </div>
  //       </div>
  //     </div>
  //   </div>
  //   <div class="w-full p-8 content">
  //     <p class="text-lg pl-3 pb-2">Enter Address:</p>
  //     <p><input class="bg-white rounded-lg py-3 px-4 w-full" maxlength="32" type="text" id="server_config_host" placeholder="78.47.144.254" value="${host}" /></p>
  //     <p class="text-lg pl-3 pb-2">Scan # of Addresses for Seed (min 10, max 500):</p>
  //     <p> <input class="bg-white rounded-lg py-3 px-4 w-full" maxlength="32" type="text" id="server_scan_addresses" placeholder="30" value="${server_scan_addresses}" /></p>
  //     <button type="submit" class="block mx-auto mt-6 bg-dark-green text-white rounded-lg text-white text-lg px-16 py-3" id="server-btn">Ok</button>
  //   </div>
  // </div>`;
    }
    modal.setContent(content);
    var serverBtn = document.getElementById("server-btn");
    serverBtn.addEventListener("click", () => {
      var config = {};

      config.lightWallet = configuration.lightWallet;

      //[0-9]+
      var res = String(document.getElementById("server_config_host").value); //.match(/^(https?:\/\/.*):(14266)$/i);
      //var server_scan_addresses_num = parseInt(String(document.getElementById("server_scan_addresses").value),10); //.match(/^(https?:\/\/.*):(14266)$/i);
      //if (server_scan_addresses_num >= 10 && server_scan_addresses_num <= 2000){
        //ok
      //}
      //else {
      //  document.getElementById("host-error").innerHTML = "Invalid # of addresses!";
      //  return;
      //}

      if (!res) {
        document.getElementById("host-error").style.display = "inline";
        document.getElementById("host-error").innerHTML = "Invalid!";
        return;
      }

      config.lightWalletHost = "http://" + res;
      config.lightWalletPort =  14266;
      config.minWeightMagnitude = "12";
      config.server_scan_addresses = 10;//server_scan_addresses_num;

      modal.close();
      ipcRenderer.send("updateNodeConfiguration", config);
    });

    modal.open();
    var modalClose = document.getElementById("modal-close");
    modalClose.addEventListener("click", () => {
      modal.close();
    });
  };

  UI.scanAddressesM = function (configuration) {
    if (showQuitAlert) {
      return;
    }
    UI.hideAlerts();
    var modal2 = new tingle.modal({
      footer: false,
      closeMethods: ["overlay", "escape"],
      cssClass: ["server-address"],
      onOpen: function () {
        //el.focus();
      },
    });
    var num = 10;
    var content = `
    <div class="flex flex-wrap h-full bg-cultured rounded-xl shadow-lg">
      <div class="w-full">
        <div class="px-6 flex flex-wrap items-center justify-between h-24 rounded-tl-xl rounded-tr-xl bg-dr-white">
          <div class="flex items-center flex-shrink-0">
            <button type="button" class="rounded-full bg-gainsboro opacity-50 text-silver text-3xl p-2" id="scan-modal-close">
              <img
                src="ui/images/close.svg"
                alt=""
              />
            </button>
          </div>
          <div class="flex flex-grow items-center w-auto">
            <div class="flex-grow text-center">
              <h2 class="font-medium text-3xl">Scan Address Balances (+ Auto-Registration)</h2>
            </div>
          </div>
        </div>
      </div>
      <div class="w-full p-8 content">
        <p class="text-lg pl-3 pb-2">Enter Number of Addresses to Scan (10-100):</p>
        <p>
        (Note1: Each address scanned will be registered, so this can take a while [PoW])<br/>
        (Note2: For better peformance try to keep addresses per seed below 100.<br/>
           Move funds to a new seed/address range if used-address-count exceeds 100.)</p>
        <p><input class="bg-white rounded-lg py-3 px-4 w-full" maxlength="32" type="text" id="cnt_addresses" placeholder="# of addresses to scan" value="${num}" /></p>
        <button type="submit" class="block mx-auto mt-6 bg-dark-green text-white rounded-lg text-white text-lg px-16 py-3" id="scan-btn">Scan!</button>
        <button type="submit" class="block mx-auto mt-6 bg-dark-green text-white rounded-lg text-white text-lg px-16 py-3" id="cancel-btn">Cancel</button>
      </div>

    </div>`;

    modal2.setContent(content);
     var scanBtn = document.getElementById("scan-btn");
     scanBtn.addEventListener("click", () => {
       var cnt_addresses = document.getElementById("cnt_addresses").value;
       if (typeof cnt_addresses == 'undefined' || parseInt(cnt_addresses,10) > 100 || parseInt(cnt_addresses,10) < 1 || isNaN(parseInt(cnt_addresses,10))){
        alert('invalid address amount');
         return;
       }
       var cnt = parseInt(cnt_addresses,10);
       ipcRenderer.send("scanAddressesConfirmed", cnt);
       //
       // aidos.api.getNewAddress(
       //    connection.seed,
       //   { returnAll: true,
       //     index: 0,
       //     checksum : false,
       //     total: cnt },
       //   function (error, address) {
       //       if (error) {
       //         return;
       //       }
       //       console.log(address);
       //       alert(length(address));
       //     }
       //  );


     });
    //
     var cancelBtn = document.getElementById("cancel-btn");
     cancelBtn.addEventListener("click", () => {
       modal2.close();
     });

     var modalClose = document.getElementById("scan-modal-close");
     modalClose.addEventListener("click", () => {
        modal2.close();
     });

     modal2.open();

  };


  // UI.showUpdateAvailable = function () {
  //   UI.showAlert(
  //     "<h1>Update Available</h1><p>An update is available and is being downloaded.</p>"
  //   );
  // };

  // UI.showUpdateDownloaded = function (releaseNotes, releaseName, releaseDate) {
  //   if (showQuitAlert) {
  //     return;
  //   }

  //   var modal = new tingle.modal({
  //     allowClose: false,
  //     footer: true,
  //     cssClass: ["update-downloaded"],
  //   });

  //   modal.setContent(
  //     "<h1>New Update Available...</h1><p>Version " +
  //       String(releaseName).escapeHTML() +
  //       " is downloaded and ready to install."
  //   );

  //   modal.addFooterBtn(
  //     "Install Now",
  //     "tingle-btn tingle-btn--primary",
  //     function () {
  //       modal.close();
  //       ipcRenderer.send("installUpdate");
  //     }
  //   );

  //   modal.addFooterBtn(
  //     "Install on Quit",
  //     "tingle-btn tingle-btn--default",
  //     function () {
  //       modal.close();
  //     }
  //   );

  //   modal.open();
  // };

  // UI.showUpdateError = function () {
  //   UI.showAlert(
  //     "<h1>Update Error</h1><p>An error occurred during checking for an update.</p>"
  //   );
  // };

  // UI.showCheckingForUpdate = function () {
  //   if (showQuitAlert) {
  //     return;
  //   }

  //   UI.showAlert(
  //     "<h1>Checking for Updates...</h1><p>Checking for updates, please wait...</p>"
  //   );
  // };

  // UI.showUpdateNotAvailable = function () {
  //   UI.showAlert(
  //     "<h1>No Updates</h1><p>No updates are currently available.</p>"
  //   );
  // };

  UI.showKillAlert = function () {
    showQuitAlert = true;
    UI.hideAlerts();

    var modal = new tingle.modal({
      footer: false,
      allowClose: false,
    });

    modal.setContent(
      "<h1>Shutdown In Progress</h1><p style='margin-bottom:0'>Shutting down Aidos... Please wait.</p>"
    );

    modal.open();
  };

  UI.hideAlerts = function () {
    var nodes = document.querySelectorAll(".tingle-modal");
    Array.prototype.forEach.call(nodes, function (node) {
      node.parentNode.removeChild(node);
    });

    var body = document.querySelector("body");
    body.classList.remove("tingle-enabled");
  };

  UI.showAlert = function (msg, openCallback, closeCallback) {
    if (showQuitAlert) {
      return;
    }
    UI.hideAlerts();

    var modal = new tingle.modal({
      footer: true,
      onOpen: function () {
        var close = document.querySelector(".tingle-modal__close");
        var modalContent = document.querySelector(".tingle-modal-box__content");
        modalContent.appendChild(close);
        if (openCallback) {
          openCallback();
        }
      },
      onClose: function () {
        if (closeCallback) {
          closeCallback();
        }
      },
    });

    modal.setContent(msg);

    modal.addFooterBtn("OK", "tingle-btn tingle-btn--primary", function () {
      modal.close();
    });

    modal.open();
  };

  UI.showAlertAndQuit = function (msg, serverOutput, callback) {
    if (showQuitAlert) {
      return;
    }

    showQuitAlert = true;
    UI.hideAlerts();

    if (!msg) {
      msg =
        "<h1>Error</h1><p>An error occurred, the server has quit. Please restart the application.</p>";
    }

    if (serverOutput && serverOutput.length) {
      var log = serverOutput.join("\n");

      log = log.replace(/\n\s*\n/g, "\n");

      var html =
        "<p>" +
        msg +
        "</p><textarea rows='6' class='form-control' readonly>" +
        String(log).escapeHTML() +
        "</textarea>";
    } else {
      var html = "<p>" + msg + "</p>";
    }

    var modal = new tingle.modal({
      footer: true,
      allowClose: false,
      onClose: function () {
        remote.getCurrentWindow().hide();
        remote.getCurrentWindow().close();
      },
    });

    modal.setContent(html);

    modal.addFooterBtn("OK", "tingle-btn tingle-btn--primary", function () {
      modal.close();
    });

    modal.open();
  };

  UI.relaunchApplication = function (didFinalize) {
    ipcRenderer.send("relaunchApplication", didFinalize);
  };

  UI.toggleDeveloperTools = function () {
    if (webviewIsLoaded && webview) {
      if (webview.isDevToolsOpened()) {
        webview.closeDevTools();
      } else {
        webview.openDevTools({ mode: "undocked" });
      }
    }
  };

  UI.sendToWebview = function (command, args) {
    if (showQuitAlert) {
      return;
    }

    if (webviewIsLoaded && webview) {
      webview.send(command, args);
    } else if (
      args &&
      args.constructor == Object &&
      args.hasOwnProperty("relaunch") &&
      args.relaunch
    ) {
      UI.relaunchApplication(true);
    }
  };

  UI.setFocus = function (focus) {
    if (webviewIsLoaded && webview) {
      webview.send("setFocus", focus);
    }
  };

  UI.notify = function (type, message, options) {
    if (webviewIsLoaded && webview) {
      webview.send("notify", type, message, options);
    }
  };

  UI.handleURL = function (url) {
    UI.hideAlerts();

    url = decodeURI(
      url.replace("aidos://", "").toLowerCase().replace(/\/$/, "")
    );

    if (url == "config" || url == "configuration" || url == "setup") {
      ipcRenderer.send("editNodeConfiguration");
    } else if (url == "log") {
      if (!lightWallet) {
        ipcRenderer.send("showServerLog");
      }
    } else if (url == "nodeinfo" || url == "node") {
      UI.sendToWebview("showNodeInfo");
    } else if (url == "peers") {
      UI.sendToWebview("showPeers");
    } else if (url == "spam" || url == "spammer") {
      UI.sendToWebview("showNetworkSpammer");
    } else if (url == "generateseed" || url == "seed") {
      UI.sendToWebview("generateSeed");
    } else if (url == "claim") {
      UI.sendToWebview("showClaimProcess");
    } else if (url == "faq") {
      UI.sendToWebview("faq");
    } else {
      var match = url.match(/(?:addnode|addneighbou?r)\/(.*)/i);
      if (match && match[1] && match[1].charAt(0) != "-") {
        if (!lightWallet) {
          UI.addPeerNode(match[1]);
        }
      } else {
        UI.sendToWebview("handleURL", url);
      }
    }
  };

  UI.relaunch = function () {
    UI.hideAlerts();
    showQuitAlert = false;
    webviewIsLoaded = false;
    var server = document.getElementById("server");
    if (server) {
      server.style.display = "none";
    }
  };

  UI.shutdown = function () {
    if (webviewIsLoaded && webview) {
      webview.send("shutdown");
    }
  };

  return UI;
})(UI || {});

window.addEventListener("load", UI.initialize, false);

window.addEventListener("focus", UI.focusOnWebview);

window.addEventListener("contextmenu", function (e) {
  e.preventDefault();
  e.stopPropagation();
  UI.showContextMenu(e);
});

ipcRenderer.on(
  "showAlertAndQuit",
  function (event, msg, serverOutput, callback) {
    UI.showAlertAndQuit(msg, serverOutput, callback);
  }
);

ipcRenderer.on("showKillAlert", UI.showKillAlert);

ipcRenderer.on("nodeStarted", function (event, url, settings) {
  UI.nodeStarted(url, settings);
});

ipcRenderer.on("showServerLog", function (event, serverOutput) {
  UI.showServerLog(serverOutput);
});

ipcRenderer.on("appendToServerLog", function (event, data) {
  UI.appendToServerLog(data);
});

ipcRenderer.on("toggleStatusBar", function (event, show) {
  UI.toggleStatusBar(show);
});

ipcRenderer.on("updateStatusBar", function (event, data) {
  UI.updateStatusBar(data);
});

ipcRenderer.on("updateAppInfo", function (event, data) {
  ipcRenderer.send("updateAppInfo", data);
});

// ipcRenderer.on("showUpdateAvailable", UI.showUpdateAvailable);

// ipcRenderer.on("showUpdateDownloaded", function (
//   event,
//   releaseNotes,
//   releaseName,
//   releaseDate
// ) {
//   UI.showUpdateDownloaded(releaseNotes, releaseName, releaseDate);
// });

// ipcRenderer.on("showUpdateError", UI.showUpdateError);

// ipcRenderer.on("showCheckingForUpdate", UI.showCheckingForUpdate);

// ipcRenderer.on("showUpdateNotAvailable", UI.showUpdateNotAvailable);

ipcRenderer.on("showPreferences", function (event, settings) {
  UI.showPreferences(settings);
});

ipcRenderer.on("showNodeInfo", function () {
  UI.hideAlerts();
  UI.sendToWebview("showNodeInfo");
});

ipcRenderer.on("showModal", function (event, identifier, html) {
  UI.hideAlerts();
  var modal = new tingle.modal({
    footer: false,
    closeMethods: ["overlay", "escape"],
    closeLabel: "Close",
    cssClass: [identifier],
  });
  modal.setContent(html);
  modal.open();
  var modalClose = document.getElementById("modal-close");
  modalClose.addEventListener("click", () => {
    modal.close();
  });
});

ipcRenderer.on("handleURL", function (event, url) {
  UI.handleURL(url);
});

ipcRenderer.on("showPeers", function () {
  UI.hideAlerts();
  UI.sendToWebview("showPeers");
});

ipcRenderer.on("showFAQ", function () {
  UI.hideAlerts();
  UI.sendToWebview("showFAQ");
});

ipcRenderer.on("showTerm", function () {
  UI.hideAlerts();
  UI.sendToWebview("showTerm");
});

ipcRenderer.on("addPeer", function (event, addedNode) {
  UI.sendToWebview("addPeer", { add: addedNode });
});

ipcRenderer.on("stopCcurl", function (event, data) {
  UI.sendToWebview("stopCcurl", data);
});

ipcRenderer.on("editNodeConfiguration", function (event, serverConfiguration) {
  UI.editNodeConfiguration(serverConfiguration);
});

ipcRenderer.on("toggleDeveloperTools", UI.toggleDeveloperTools);

ipcRenderer.on("setFocus", function (event, focus) {
  UI.setFocus(focus);
});

ipcRenderer.on("hoverAmountStart", function (event, amount) {
  UI.updateStatusBar({ hoverAmount: amount });
});

ipcRenderer.on("hoverAmountStop", function () {
  UI.updateStatusBar({ hoverAmount: -1 });
});

ipcRenderer.on("notify", function (event, type, message, options) {
  UI.notify(type, message, options);
});

ipcRenderer.on("relaunch", UI.relaunch);

ipcRenderer.on("shutdown", UI.shutdown);
