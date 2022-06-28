import * as electron from 'electron';
import * as fs from 'fs';
import {resolve} from 'path';

export default class LastFMPlugin {
    private sessionPath = resolve(electron.app.getPath('userData'), 'session.json');
    private apiCredentials = {
        key: "f9986d12aab5a0fe66193c559435ede3",
        secret: "acba3c29bd5973efa38cc2f0b63cc625"
    }
    /**
     * Private variables for interaction in plugins
     */
    private _win: any;
    private _app: any;
    private _lastfm: any;
    private _store: any;
    private _timer: any;

    private authenticateFromFile() {
        let sessionData = require(this.sessionPath)
        console.log("[LastFM][authenticateFromFile] Logging in with Session Info.")
        this._lastfm.setSessionCredentials(sessionData.username, sessionData.key)
        console.log("[LastFM][authenticateFromFile] Logged in.", sessionData.username, sessionData.key)
    }


        // Register the ipcMain handlers
        this._utils.getIPCMain().handle('lastfm:url', (event: any) => {
            console.debug(`${lastfm.name}:url`)
            return this._lfm.getAuthenticationUrl({"cb": "cider://auth/lastfm"})
        })
        electron.app.on('open-url', (event: any, arg: any) => {
            console.log('[LastFMPlugin] yes')
            event.preventDefault();
            if (arg.includes('auth')) {
                let authURI = String(arg).split('/auth/')[1];
                if (authURI.startsWith('lastfm')) { // If we wanted more auth options
                    const authKey = authURI.split('lastfm?token=')[1];
                    this._store.lastfm.enabled = true;
                    this._store.lastfm.auth_token = authKey;
                    this._win.webContents.send('LastfmAuthenticated', authKey);
                    console.log(authKey);
                    this.authenticate();
                }
            }
        })
    }

    /**
     * Runs on app ready
     */
    onReady(win: any): void {
        this._win = win;
        this.authenticate();
    }

    /**
     * Runs on app stop
     */
    onBeforeQuit(): void {
        console.log('Example plugin stopped');
    }

    /**
     * Runs on song change
     * @param attributes Music Attributes
     */
    onNowPlayingItemDidChange(attributes: any): void {
        if (this._utils.getStoreValue("general.privateEnabled")) return;
        this._attributes = attributes
        if (!attributes?.lfmTrack || !attributes?.lfmAlbum) {
            this.verifyTrack(attributes)
            return
        }
        this.scrobbleTrack(attributes)
        this.updateNowPlayingTrack(attributes)
    }

    /**
     * Initialize LastFM
     * @param token
     * @param api
     * @private
     */
    private initializeLastFM(token: string, api: { key: string, secret: string }): void {
        const LastfmAPI = require("lastfmapi")
        this._lfm = new LastfmAPI({
            'api_key': api.key,
            'secret': api.secret,
        });

        if (this._utils.getStoreValue("connectivity.lastfm.secrets.username") && this._utils.getStoreValue("connectivity.lastfm.secrets.key")) {
            this._lfm.setSessionCredentials(this._utils.getStoreValue("connectivity.lastfm.secrets.username"), this._utils.getStoreValue("connectivity.lastfm.secrets.key"));
            this._authenticated = true;
        } else {
            this.authenticateLastFM(token)
        }
    }

    /**
     * Authenticate the user with the given token
     * @param token
     * @private
     */
    private authenticateLastFM(token: string): void {
        if (!token) return;
        this._lfm.authenticate(token, (err: any, session: any) => {
            if (err) {
                console.error(err);

                this._utils.getWindow().webContents.executeJavaScript(`app.notyf.error("${err.message}");`)
                return;
            }
            this.updateNowPlayingSong(attributes)
            this.scrobbleSong(attributes)
        }
    }

}
