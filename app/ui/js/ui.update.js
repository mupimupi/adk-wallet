var UI = (function (UI, $, undefined) {
  UI.updateIntervalTime = 0;

  var isUpdatingState = false;
  var updateInterval = null;

  function stateExecution(callback) {
    if (connection.seed) {
      aidos.api.getNodeInfo(function (error, info) {
        connection.nodeInfo = info;
        if (info && info.appVersion && info.appVersion.substr(0,2)!= "2."){
          alert("You are not connected to an ADKGO (ADKv2) node. This wallet will not work with older nodes. The node version you are trying to connect to is "+info.appVersion);
          return;
        }
        aidos.api.getAccountData(
          connection.seed,
          //{
          //  start:0,
          //  end:10
          //},
          function (error, accountData) {
            connection.previousAccountData = connection.accountData;
            connection.accountData = accountData;
            callback(error, accountData);
          }
        );
      });
    } else {
      aidos.api.getNodeInfo(function (error, info) {
        connection.nodeInfo = info;
        if (info && info.appVersion && info.appVersion.substr(0,2)!= "2."){
          alert("You are not connected to an ADKGO (ADKv2) node. This wallet will not work with older nodes. The node version you are trying to connect to is "+info.appVersion);
          return;
        }

        if (callback) {
          callback(error, info);
        }
      });
    }
  }

  UI.executeState = function (callback) {
    return stateExecution(callback);
  };

  UI.updateState = function (timeout) {
    if (timeout) {
      setTimeout(function () {
        UI.createStateInterval(UI.updateIntervalTime, true);
      }, timeout);
    } else {
      UI.createStateInterval(UI.updateIntervalTime, true);
    }
  };

  UI.createStateInterval = function (ms, immediately) {
    console.log("UI.createStateInterval: " + ms);

    UI.updateIntervalTime = ms;

    // If connecting to a light wallet, minimum state interval is set to 1 minute.
    if (connection.lightWallet && ms < 60000) {
      ms = 60000;
    }

    if (updateInterval) {
      clearInterval(updateInterval);
    }

    updateInterval = setInterval(function () {
      if (!isUpdatingState && !UI.isLoggingIn) {
        isUpdatingState = true;
        stateExecution(function (error) {
          if (!error) {
            UI.update();
          }
          isUpdatingState = false;
        });
      }
    }, ms);

    if (immediately) {
      console.log("UI.createStateInterval: Execute immediately");
      if (!isUpdatingState) {
        isUpdatingState = true;
        stateExecution(function (error) {
          if (!error) {
            UI.update();
          } else if (!connection.seed && connection.lightWallet) {
            //Show error specifically for light nodes...
            UI.notify("error", "Could not connect to remote node.");
          }
          isUpdatingState = false;
        });
      } else {
        console.log(
          "UI.createStateInterval: Cannot execute immediately, already updating state"
        );
      }
    }
  };


  UI.update = function () {
    console.log("update");
    if (!UI.initialConnection && connection.nodeInfo) {
      console.log("We have an initial connection.");
      UI.initialConnection = true;
      connection.minWeightMagnitude = 15;
      if (connection.inApp && connection.lightWallet) {
        updateAppInfo({
          name: connection.nodeInfo.appName,
          version: connection.nodeInfo.appVersion,
          testnet: false,
        });
      }
      $(document).trigger("initialConnection");
      if (!connection.seed) {
        // After initial connection, update state every 2 seconds
        UI.createStateInterval(2000, false);
      }
    }

    if (connection.nodeInfo && connection.inApp) {
      updateStatusBar({
        latestMilestoneIndex: connection.nodeInfo.latestMilestoneIndex,
        latestSolidSubmeshMilestoneIndex:
          connection.nodeInfo.latestSolidSubmeshMilestoneIndex,
      });
    }

    if (!connection.seed) {
      if (!UI.showLoginForm) {
        UI.showLoginForm = true;
      } else if (!UI.loginFormShown) {
        UI.fadeInLoginForm();
      } else {
        UI.updateLoginForm();
      }
    } else {
      if (connection.accountData) {
        UI.updateBalance();
      }
      UI.updateNotification();
      UI.updateHistory();
      UI.refreshTransaction();
    }
  };

  return UI;
})(UI || {}, jQuery);
