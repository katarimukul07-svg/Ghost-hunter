// Built into a local ESM bundle; never resolve package imports from a CDN.
import {Capacitor} from '@capacitor/core';
import {SecureStorage,KeychainAccess} from '@aparajita/capacitor-secure-storage';
export async function nativeStorage(projectUrl){
 if(!Capacitor.isNativePlatform())throw Error('Native storage required');
 const project=new URL(projectUrl).hostname;
 await SecureStorage.setKeyPrefix('ghostHunter.session.'+project+'.');
 if(Capacitor.getPlatform()==='ios'){
  await SecureStorage.setSynchronize(false);
  await SecureStorage.setDefaultKeychainAccess(KeychainAccess.whenUnlockedThisDeviceOnly);
 }
 return SecureStorage;
}
