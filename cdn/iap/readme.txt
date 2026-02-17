INSTALLING AND UNLOCKING GUIDE:

TL;DR: The step-by-step guide is quite long because I wanted to make it as easy to follow as possible, but please bear in mind it's just a few simple steps, they're as follows (assuming you have all the required tweaks already installed):

1- Install the cracked .IPA of this game.
2- Install a legit game through the AppStore (Temple Run recommended).
3- Copy iTunesMetadata personal info from legit to cracked game.
4- Use an IAP cracker to bypass the full game purchase. (My iAP Cracker recommended)

Now a step-by-step guide on how to do this:
(Note: This guide is written to be followed using 3utools on PC but you can use any other program of your choice, all you need to do is install an .ipa and copy/paste a file in the applications directory)


**Step 1: Prepare Your Device**
Before you begin, make sure your iOS device is jailbroken (if you need a guide on jailbreaking check ios.cfw.guide). Additionally, ensure you have the following tweaks:

- **AppSync:** Download and install AppSync from https://cydia.akemi.ai on Cydia. After installation, perform a full reboot to prevent any potential issues.

- **Apple File Conduit 2 (AFC2):** If you haven't already, get Apple File Conduit 2 from http://apt.saurik.com. I recommend to install it after AppSync and respring your device.

- **In-App Purchase (IAP) Cracker:** I recommend using My iAP Cracker from http://repo.hackyouriphone.org, I have included it on this upload in case that repo ever goes down. "localiapstore" also works but does not work on iOS 10 and requires an older version to be manually installed on version lower than ios 7, other iap crackers I've tried don't work.
Note: After installing, make sure to enable it in setings, if you install the IAP cracker through Filza tap on "actions" and choose respring after it finishes installing! Otherwise it wont appear in setting and you wont be able to enable it.

- **AppStore Fix:** If you're using an iOS version older than 7, you'll need a tweak to be able to access the appstore, it's needed so that you can download an app later on to extract some stuff to use with this one to be able to unlock the full game (and I think is also needed to be able to crack the in app purchase of the full game). Install ItunesStoreX from this repo: http://cydia.mali357.gay
You may also want to install "Checkmate Appstore" from https://cydia.invoxiplaygames.uk


**Step 2: Install Banshee's Last Cry**

1. Download "com.aksysgames.banshees-last-cry-iOS5.1-(Clutch-2.0.4).ipa" from my upload.

2. Connect your jailbroken iOS device to your computer and open 3utools.

3. Verify that your device is recognized as "Jailbroken: Yes" on the device information page. If it indicates that you need to "Install AppSync" or "Install AFC2", reinstall the respective tweak.

4. Navigate to the "Apps" section on your device.

5. Click on "Import and install IPA."

6. Choose the IPA file you downloaded on step 1 and allow it to install. This process may take some time.

**NOTE: Do not open the game yet! There's still some stuff left to do before that.**


**Step 3: Preparations for In-App Purchases (IAP)**

1. Download Temple Run from the App Store. If it says that your iOS version is incompatible, try downloading it on a newer device first and then try again, it should prompt you  to download an older compatible version. (It's not necessary to open or make an in-app purchase in this app, simply install it.)

- Why do I need this?
- In-app purchases dont work on sideloaded/cracked games, if they don't work, we can't use an IAP cracker to get them for free. In order to fix this, you need to install a legitimate app to get a legitimate "iTunesMetadata.plist" file along with it.

- This file contains (among other things) critical information about your Apple ID and other unique values for your account and your device uses it to know if you own an app or not, we will be using this to hack Banshee's Last Cry.
I've tried this with Temple Run and it includes all the values we need. Other apps/games might not have all these values.


**Step 4: Extract values from legit "iTunesMetadata.plist"**

1. Use 3uTools to copy the "iTunesMetadata.plist" file from your chosen legitimate app (e.g., Temple Run) to a location on your computer:
	1.a: Click on "Files" on the left panel 
	1.b: Click on "Applications (User)"
	1.c: Open the folder of your legit app (e.g, Temple Run)
	1.d: Drag and drop "iTunesMetadata.plist" somewhere on your computer.


2. Open "iTunesMetadata.plist" using a plist viewer, I recommend ProperTree.

3. Find and copy three specific values: "AccountStoreFront", "AppleID", and "DSPersonID". Paste these values into a text file temporarily for reference. Only these three values are needed. (Note: on iOS 10 you won't find an "AccountStoreFront", this is normal, you dont need "AccountStoreFront" for iOS 10 so don't worry)


**Step 5: Modify "iTunesMetadata.plist" for Banshee's Last Cry**

1. Download the "iTunesMetadata.plist" file I uploaded.

2. Open this file with your plist viewer (e.g ProperTree).

3. Replace the values from the "iTunesMetadata.plist" you just downloaded with the values you copied from your legit app's (e.g Temple Run) "iTunesMetadata.plist". These values are "AccountStoreFront", "AppleID", and "DSPersonID". (Keep in mind that iOS 10 doesn't need "AccountStoreFront" so leave it as is)

4. Save your changes using your plist viewer's save function.


**Step 6: Transfer Modified "iTunesMetadata.plist" to your iDevice**

1. In 3utools, click on Files on your device panel, just like how you did when copying "iTunesMetadata.plist" earlier.

2. Click on Applications (User) and open the folder of Banshee's Last Cry this time

3. Drag and drop the modified "iTunesMetadata.plist" you just saved to this folder

4. Disconnect your iOS device from your computer.

5. I recommend doing a respring or full reboot of your device before proceeding.


**Last Step: Unlock the full game**

1. Open Banshee's Last Cry. (This should be the 1st time you opened it, if you opened it before this step, delete and reinstall the app and start from the beginning!)

2. On the game's main menu, tap on "purchase".

3. The game should then fade to black and return with the purchase button removed, then the purchase confirmation will pop up, you can tap cancel (if you're using localiapstore, the purchase confirmation pops up first, then you tap cancel and the game should unlock)

Congratulations! You have successfully installed and fully unlocked Banshee's Last Cry!


**Troubleshooting:**

- If the game doesn't unlock after tapping "purchase" and "cancel," try uninstalling your IAP cracker through Cydia and install the one provided in the upload using iFile or Filza. Afterward, respring, check in settings that the IAP is enabled and try again.

- If you encounter an error about not being able to save when starting a new game, something went wrong in one of the steps. Uninstall the app, start over, and ensure you follow all the steps correctly. Remember not to open the game before copying the modified "iTunesMetadata.plist"!!


I will update this guide if anything changes!

