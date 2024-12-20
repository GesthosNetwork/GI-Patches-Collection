function main(stage, parameters) {
    if (!parameters.redirectHost) {
        console.log("redirectHost parameter not specified!\nEdit your gadget.config and specify redirectHost in \"parameters\" section.");
        return;
    }

    if (!parameters.alwaysIgnoreDomains || !Array.isArray(parameters.alwaysIgnoreDomains)) {
        console.log("alwaysIgnoreDomains parameter missing or invalid! Ensure it's an array in your config.");
        return;
    }

    const UnityWebRequestSetUrlPtr = Helpers.FindMethodImpl("UnityEngine.UnityWebRequestModule.dll", "UnityEngine.Networking", "UnityWebRequest", "set_url", 1);
    const UriCtorPtr = Helpers.FindMethodImpl("System.dll", "System", "Uri", ".ctor", 1);

    console.log("Found UnityWebRequest::set_url at " + UnityWebRequestSetUrlPtr);
    console.log("Found Uri::ctor at " + UriCtorPtr);

    RedirectCallback.targetHost = parameters.redirectHost;
    RedirectCallback.alwaysIgnoreDomains = parameters.alwaysIgnoreDomains;

    Interceptor.attach(UnityWebRequestSetUrlPtr, RedirectCallback);
    Interceptor.attach(UriCtorPtr, RedirectCallback);

    console.log("Attached successfully, will redirect all requests to: " + parameters.redirectHost);

    const BrowserLoadURL = Helpers.FindMethodImpl("ZFBrowser.dll", "ZenFulcrum.EmbeddedBrowser", "Browser", "LoadURL", 2);

    if (BrowserLoadURL) {
        Interceptor.attach(BrowserLoadURL, {
            onEnter(args) {
                var requestUrl = args[1].readCSharpString();
                var hostname = extractHostname(requestUrl);

                for (const domain of RedirectCallback.alwaysIgnoreDomains) {
                    if (hostname.endsWith(domain)) {
                        console.log(`[Fetching]: ${requestUrl}`);
                        return;
                    }
                }

                var prefix = requestUrl.split('/', 3).join('/');
                args[1] = Il2cppApiWrap.AllocateString(requestUrl.replace(prefix, parameters.redirectHost));

                console.log("[EmbeddedBrowser]: " + args[1].readCSharpString());
            }
        });

        console.log("Successfully hooked EmbeddedBrowser");
    }
}

const RedirectCallback = {
    onEnter(args) {
        var requestUrl = args[1].readCSharpString();
        if (!requestUrl.startsWith("http://") && !requestUrl.startsWith("https://")) {
            return;
        }

        var hostname = extractHostname(requestUrl);
        for (const domain of RedirectCallback.alwaysIgnoreDomains) {
            if (hostname.endsWith(domain)) {
                console.log(`[Fetching]: ${requestUrl}`);
                return;
            }
        }

        if (requestUrl.includes(RedirectCallback.targetHost)) {
            return;
        }

        var prefix = requestUrl.split('/', 3).join('/');
        args[1] = Il2cppApiWrap.AllocateString(requestUrl.replace(prefix, RedirectCallback.targetHost));

        console.log("[Redirected]: " + args[1].readCSharpString());
    }
};

function extractHostname(url) {
    const match = url.match(/:\/\/(.[^/]+)/);
    return match ? match[1] : null;
}

const Helpers = {
    FindMethodImpl(moduleName, namespace, className, methodName, argCount) {
        const module = Il2cppApiWrap.GetImageByName(moduleName);
        if (module.equals(ptr(0))) return null;

        const il2cppClass = Il2cppApiWrap.GetClassByName(module, namespace, className);
        if (il2cppClass.equals(ptr(0))) return null;

        const il2cppMethod = Il2cppApiWrap.GetClassMethodByName(il2cppClass, methodName, argCount);
        if (il2cppMethod.equals(ptr(0))) return null;

        return il2cppMethod.readPointer();
    }
};

const Il2cppApiWrap = {
    AllocateString(value) {
        const pValue = Memory.allocUtf16String(value);

        return this.CallApiFunction('il2cpp_string_new_utf16', 'pointer', ['pointer', 'int'], [pValue, value.length]);
    },
    GetClassMethodByName(il2cppClass, name, argsCount) {
        const pName = Memory.allocUtf8String(name);

        return this.CallApiFunction('il2cpp_class_get_method_from_name', 'pointer', ['pointer', 'pointer', 'int'], [il2cppClass, pName, argsCount]);
    },
    GetClassByName(il2cppImage, namespace, name) {
        const pNamespace = Memory.allocUtf8String(namespace);
        const pName = Memory.allocUtf8String(name);

        return this.CallApiFunction('il2cpp_class_from_name', 'pointer', ['pointer', 'pointer', 'pointer'], [il2cppImage, pNamespace, pName]);
    },
    GetImageByName(name) {
        const domain = this.CallApiFunction('il2cpp_domain_get', 'pointer', [], []);

        const sizeOut = Memory.alloc(8);
        const assemblies = this.CallApiFunction('il2cpp_domain_get_assemblies', 'pointer', ['pointer', 'pointer'], [domain, sizeOut]);

        const size = sizeOut.readU64();
        for (var i = 0; i < size; i++) {
            const assembly = assemblies.add(i * 8).readPointer();
            const il2cppImage = this.CallApiFunction('il2cpp_assembly_get_image', 'pointer', ['pointer'], [assembly]);

            const imageName = this.CallApiFunction('il2cpp_image_get_name', 'pointer', ['pointer'], [il2cppImage]);
            if (imageName.readUtf8String() == name) {
                return il2cppImage;
            }
        }

        return null;
    },
    CallApiFunction(name, rettype, argTypes, args) {
        const nativeFunction = new NativeFunction(Module.findExportByName(null, name), rettype, argTypes);
        return nativeFunction.apply(nativeFunction, args);
    }
};

NativePointer.prototype.readCSharpString = function() {
    var length = this.add(16).readInt();
    return this.add(20).readUtf16String(length);
};

rpc.exports.init = main;
