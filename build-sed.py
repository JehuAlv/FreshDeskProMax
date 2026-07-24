import sys, os
td = sys.argv[1]
output = sys.argv[2]
ver = sys.argv[3]
P = chr(37)
Q = chr(34)
B = chr(92)
lines = [
    "[Version]",
    "Class=IEXPRESS",
    "SEDVersion=3",
    "[Options]",
    "PackagePurpose=InstallApp",
    "ShowInstallProgramWindow=0",
    "HideExtractAnimation=0",
    "UseLongFileName=1",
    "InsideCompressed=0",
    "CAB_FixedSize=0",
    "CAB_ResvCodeSigning=0",
    "RebootMode=N",
    "InstallPrompt=" + P + "InstallPrompt" + P,
    "DisplayLicense=" + P + "DisplayLicense" + P,
    "FinishMessage=" + P + "FinishMessage" + P,
    "TargetName=" + P + "TargetName" + P,
    "FriendlyName=" + P + "FriendlyName" + P,
    "AppLaunched=" + P + "AppLaunched" + P,
    "PostInstallCmd=" + P + "PostInstallCmd" + P,
    "AdminQuietInstCmd=" + P + "AdminQuietInstCmd" + P,
    "UserQuietInstCmd=" + P + "UserQuietInstCmd" + P,
    "SourceFiles=SourceFiles",
    "[Strings]",
    "InstallPrompt=Install Freshdesk Dashboard " + ver + "?",
    "DisplayLicense=",
    "FinishMessage=",
    "TargetName=" + output,
    "FriendlyName=Freshdesk Dashboard " + ver,
    "AppLaunched=wscript launcher.vbs",
    "PostInstallCmd=<None>",
    "AdminQuietInstCmd=",
    "UserQuietInstCmd=",
    "FILE0=" + Q + "bootstrap.cmd" + Q,
    "FILE1=" + Q + "FreshdeskDashboard.zip" + Q,
    "FILE2=" + Q + "launcher.vbs" + Q,
    "[SourceFiles]",
    "SourceFiles0=" + td + B,
    "[SourceFiles0]",
    P + "FILE0" + P + "=",
    P + "FILE1" + P + "=",
    P + "FILE2" + P + "=",
]
with open(os.path.join(td, "installer.sed"), "w", newline="\r\n") as f:
    for line in lines:
        f.write(line + "\n")
