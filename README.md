<h1 align="center">
  <br>
  <a href="https://aidoskuneen.com"><img src="https://aidoskuneen.com/wp-content/uploads/2020/08/cropped-adk-logo-footer-192x192.png" alt="Aidos Kuneen"></a>
  <br>
  Aidos Kuneen Wallet for ADKGO Nodes ( TESTNET )
  <br>
  </h1>
  <ul>
  <li> PLEASE NOTE: This is a TESTNET VERSION. USE AT OWN RISK. </li>
  <li> Only use if you are part of the testing team and have been instructed to use this version. </li>
  <li> DO NOT USE THE TESTNET VERSION WITH YOUR MAINNET SEEDS! </li>

	</ul>


<h6 align="center">This repository contains the TESTNET desktop wallet for Aidos Kuneen ADK</h6>


## Requirements

1. Operating System
   - Linux 64 bit (32bit not supported)
   - Windows 64bit and 32bit
   - MacOS 64bit (32bit not supported)
2. [NodeJS](https://nodejs.org/en/download/)

NodeJS is required to install and run the app.

### For Windows Users

```
yarn install -g --production windows-build-tools
```

This needs to be run in a cmd window with elevated rights (Administrator).

If you want to package the wallet you will need:

1. [Electron Builder](https://github.com/electron-userland/electron-builder)


## Build & Run

These instructions are only in case you want to build the wallet by yourself. Pre-built packages are available on [Release Page](https://github.com/AidosKuneen/aidos-wallet-adkgo-testnet/releases).

1. Clone this repository:

```
git clone https://github.com/AidosKuneen/aidos-wallet-adkgo-testnet
```

2. Install dependencies:

```
yarn install
```

3. Run the app:

```
yarn start
```

4. If you wish to compile the app:

```
yarn compile
```

If you'd like to create a package only for a specific OS, you can do so by running:

```
yarn compile:win  (tested)
yarn compile:mac  (not yet tested)
yarn compile:lin  (not yet tested)
```

You need the specific OS for each package (i.e. cannot cross compile).

5.  After that you can find the compiled binaries in the `out` dir.

## LICENSE

[GNU General Public License v3.0](https://github.com/AidosKuneen/aidos-wallet-adkgo-testnet/blob/master/LICENSE)
