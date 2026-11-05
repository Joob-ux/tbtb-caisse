package sn.xelkoom.tbtb;

import android.annotation.SuppressLint;
import android.os.Bundle;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import androidx.appcompat.app.AppCompatActivity;

/**
 * Appli Caisse T.B.T.B pour TPE Sunmi.
 * Affiche l'interface web embarquée (assets/www) et lui donne accès à l'imprimante
 * via l'objet JavaScript window.SunmiPrinter.
 */
public class MainActivity extends AppCompatActivity {

    private WebView webView;
    private PrinterBridge printer;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        printer = new PrinterBridge(this);
        printer.connect();

        webView = new WebView(this);
        WebSettings s = webView.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);          // historique des reçus (localStorage)
        s.setAllowFileAccess(true);
        s.setTextZoom(100);
        webView.setWebViewClient(new WebViewClient());
        webView.addJavascriptInterface(printer, "SunmiPrinter");
        webView.loadUrl("file:///android_asset/www/index.html");

        setContentView(webView);
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) webView.goBack();
        else super.onBackPressed();
    }

    @Override
    protected void onDestroy() {
        if (printer != null) printer.disconnect();
        super.onDestroy();
    }
}
