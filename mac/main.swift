// What Are We Watching — the Mac app.
//
// A window onto the live site, so the app and the website are always the same
// build. Links that leave the site (WHERE TO WATCH) open in the default browser.
// Offline, it says so and offers Retry.
//
//   ./"What Are We Watching.app"/Contents/MacOS/WhatAreWeWatching --selftest
// loads the site, waits for the TV, presses SURPRISE ME, prints the pick, exits 0/1.
import AppKit
import WebKit

let SITE = URL(string: "https://themaxlong.github.io/WhatAreWeWatchingv503/")!
let NIGHT = NSColor(srgbRed: 7 / 255, green: 8 / 255, blue: 13 / 255, alpha: 1)
let SELFTEST = CommandLine.arguments.contains("--selftest")

final class AppDelegate: NSObject, NSApplicationDelegate, WKNavigationDelegate, WKUIDelegate {
    var window: NSWindow!
    var web: WKWebView!

    func applicationDidFinishLaunching(_ note: Notification) {
        buildMenu()

        let config = WKWebViewConfiguration()
        config.mediaTypesRequiringUserActionForPlayback = []
        web = WKWebView(frame: .zero, configuration: config)
        web.navigationDelegate = self
        web.uiDelegate = self
        web.setValue(false, forKey: "drawsBackground")   // night shows through until the page paints

        window = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 1440, height: 900),
                          styleMask: [.titled, .closable, .miniaturizable, .resizable, .fullSizeContentView],
                          backing: .buffered, defer: false)
        window.title = "What Are We Watching"
        window.titleVisibility = .hidden
        window.titlebarAppearsTransparent = true           // the store runs edge to edge
        window.backgroundColor = NIGHT
        window.appearance = NSAppearance(named: .darkAqua)
        window.minSize = NSSize(width: 380, height: 600)
        window.contentView = web
        window.center()
        window.setFrameAutosaveName("MainWindow")
        window.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)

        load()
        if SELFTEST { runSelfTest() }
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ app: NSApplication) -> Bool { true }

    // the page is cached for 10 minutes by GitHub Pages; revalidate so a new deploy shows on launch
    @objc func load() {
        web.load(URLRequest(url: SITE, cachePolicy: .reloadRevalidatingCacheData, timeoutInterval: 30))
    }

    // ── leaving the site opens the browser ──────────────────────────────────
    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration,
                 for action: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        if let url = action.request.url { NSWorkspace.shared.open(url) }
        return nil
    }

    func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction,
                 decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let url = action.request.url else { return decisionHandler(.allow) }
        let ours = url.host == SITE.host || url.scheme == "about" || url.scheme == "data"
        if action.navigationType == .linkActivated && !ours {
            NSWorkspace.shared.open(url)
            return decisionHandler(.cancel)
        }
        decisionHandler(.allow)
    }

    // ── offline ─────────────────────────────────────────────────────────────
    func webView(_ webView: WKWebView, didFailProvisionalNavigation nav: WKNavigation!, withError error: Error) {
        showOffline(error)
    }

    func webView(_ webView: WKWebView, didFail nav: WKNavigation!, withError error: Error) {
        showOffline(error)
    }

    func showOffline(_ error: Error) {
        if SELFTEST { print("selftest: FAIL — could not load \(SITE): \(error.localizedDescription)"); exit(1) }
        let html = """
        <!doctype html><meta charset=utf-8><style>
        html,body{margin:0;height:100%;background:#07080d;color:#f6f0de;font:600 16px -apple-system,sans-serif;
        display:grid;place-items:center;text-align:center}
        h1{font:400 44px ui-monospace,monospace;letter-spacing:.06em;color:#6dff7a;margin:0 0 12px}
        p{color:#b9b3a5;margin:0 0 24px}
        button{font:800 15px -apple-system,sans-serif;letter-spacing:.08em;padding:12px 22px;border:0;border-radius:3px;
        background:#ffd21f;color:#0b1d6b;cursor:pointer}
        </style><div><h1>NO SIGNAL</h1><p>The store is out of reach — check the connection.</p>
        <button onclick="location.href='\(SITE.absoluteString)'">RETRY</button></div>
        """
        web.loadHTMLString(html, baseURL: nil)
    }

    // ── menus: the Edit menu is what makes copy/paste work in the actor box ─
    func buildMenu() {
        let main = NSMenu()
        let appItem = NSMenuItem(); main.addItem(appItem)
        let appMenu = NSMenu()
        appMenu.addItem(withTitle: "About What Are We Watching", action: #selector(NSApplication.orderFrontStandardAboutPanel(_:)), keyEquivalent: "")
        appMenu.addItem(.separator())
        appMenu.addItem(withTitle: "Hide What Are We Watching", action: #selector(NSApplication.hide(_:)), keyEquivalent: "h")
        appMenu.addItem(withTitle: "Quit What Are We Watching", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")
        appItem.submenu = appMenu

        let editItem = NSMenuItem(); main.addItem(editItem)
        let edit = NSMenu(title: "Edit")
        edit.addItem(withTitle: "Undo", action: Selector(("undo:")), keyEquivalent: "z")
        edit.addItem(withTitle: "Redo", action: Selector(("redo:")), keyEquivalent: "Z")
        edit.addItem(.separator())
        edit.addItem(withTitle: "Cut", action: #selector(NSText.cut(_:)), keyEquivalent: "x")
        edit.addItem(withTitle: "Copy", action: #selector(NSText.copy(_:)), keyEquivalent: "c")
        edit.addItem(withTitle: "Paste", action: #selector(NSText.paste(_:)), keyEquivalent: "v")
        edit.addItem(withTitle: "Select All", action: #selector(NSText.selectAll(_:)), keyEquivalent: "a")
        editItem.submenu = edit

        let viewItem = NSMenuItem(); main.addItem(viewItem)
        let view = NSMenu(title: "View")
        let reload = NSMenuItem(title: "Reload", action: #selector(load), keyEquivalent: "r"); reload.target = self
        view.addItem(reload)
        let full = NSMenuItem(title: "Enter Full Screen", action: #selector(NSWindow.toggleFullScreen(_:)), keyEquivalent: "f")
        full.keyEquivalentModifierMask = [.control, .command]
        view.addItem(full)
        viewItem.submenu = view

        let winItem = NSMenuItem(); main.addItem(winItem)
        let win = NSMenu(title: "Window")
        win.addItem(withTitle: "Minimize", action: #selector(NSWindow.performMiniaturize(_:)), keyEquivalent: "m")
        win.addItem(withTitle: "Close", action: #selector(NSWindow.performClose(_:)), keyEquivalent: "w")
        winItem.submenu = win
        NSApp.windowsMenu = win

        NSApp.mainMenu = main
    }

    // ── --selftest: the app does its one job, end to end ────────────────────
    func runSelfTest() {
        var tries = 0
        func poll() {
            tries += 1
            web.evaluateJavaScript("[document.documentElement.classList.contains('tv-ready'), document.documentElement.classList.contains('no-webgl') ? 'flat' : '3d']") { result, _ in
                let r = result as? [Any] ?? []
                if (r.first as? Bool) == true {
                    print("selftest: TV up (\(r.count > 1 ? "\(r[1])" : "?"))")
                    self.web.evaluateJavaScript("document.getElementById('surpriseBtn').click()") { _, _ in
                        DispatchQueue.main.asyncAfter(deadline: .now() + 2.5) {
                            self.web.evaluateJavaScript("[document.getElementById('cardTitle').textContent, FILMS.some(f => f.t === document.getElementById('cardTitle').textContent)]") { res, _ in
                                let p = res as? [Any] ?? []
                                let title = p.first as? String ?? ""
                                let real = (p.count > 1 ? p[1] as? Bool : nil) ?? false
                                print("selftest: SURPRISE ME picked \"\(title)\" — \(real ? "a real film" : "NOT a film")")
                                print(real ? "selftest: PASS" : "selftest: FAIL")
                                exit(real ? 0 : 1)
                            }
                        }
                    }
                } else if tries > 60 {
                    print("selftest: FAIL — TV never came up"); exit(1)
                } else {
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.5, execute: poll)
                }
            }
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 1, execute: poll)
    }
}

let app = NSApplication.shared
let delegate = AppDelegate()
app.delegate = delegate
app.setActivationPolicy(.regular)
app.run()
