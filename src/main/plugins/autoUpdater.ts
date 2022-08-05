import { autoUpdater } from 'electron-updater';
export default class mpris {
  /**
   * Private variables for interaction in plugins
   */
  private _utils: any;

  /**
   * Base Plugin Details (Eventually implemented into a GUI in settings)
   */
  public name: string = "Cider Auto Updater";
  public description: string = "Auto updates for Cider builds on .exe, .dmg, and .appImage";
  public version: string = "1.0.0";
  public author: string = "Core";

  /*******************************************************************************************
   * Private Methods
   * ****************************************************************************************/

  /**
   * Runs on plugin load (Currently run on application start)
   */
  constructor(utils: any) {
    this._utils = utils;

    console.debug(`[Plugin][${this.name}] Loading Complete.`);

    autoUpdater.setFeedURL({
      provider: 'github',
      owner: 'ciderapp',
      repo: 'cider-releases',
      private: false,
      token: process.env.GH_TOKEN, // provide your github access token, with repo:access
    });

    utils.getApp().on('ready', function()  {
      autoUpdater.checkForUpdates();
    });
    autoUpdater.on('checking-for-update', () => {
      console.log('Checking for update...');
    })
    autoUpdater.on('update-available', (info) => {
      console.log('Update available.');
    })
    autoUpdater.on('update-not-available', (info) => {
      console.log('Update not available.');
    })
    autoUpdater.on('error', (err) => {
      console.log('Error in auto-updater.');
    })
    autoUpdater.on('download-progress', (progressObj) => {
      console.log('Download progress...');
    })
    autoUpdater.on('update-downloaded', (info) => {
      console.log('Update downloaded.');
      autoUpdater.quitAndInstall();
    })

  }




}
