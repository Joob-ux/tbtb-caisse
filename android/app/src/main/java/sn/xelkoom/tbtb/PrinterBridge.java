package sn.xelkoom.tbtb;

import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.util.Base64;
import android.webkit.JavascriptInterface;

import com.sunmi.peripheral.printer.InnerPrinterCallback;
import com.sunmi.peripheral.printer.InnerPrinterException;
import com.sunmi.peripheral.printer.InnerPrinterManager;
import com.sunmi.peripheral.printer.SunmiPrinterService;

import org.json.JSONObject;

/**
 * Pont entre l'interface web et l'imprimante thermique intégrée du Sunmi V2s (58 mm, 384 points).
 * Côté JavaScript : window.SunmiPrinter.print(JSON) renvoie "ok" ou un message d'erreur.
 */
public class PrinterBridge {

    private static final byte[] BOLD_ON = {0x1B, 0x45, 0x01};
    private static final byte[] BOLD_OFF = {0x1B, 0x45, 0x00};
    private static final int PAPER_DOTS = 384;

    private final Context context;
    private volatile SunmiPrinterService service;

    private final InnerPrinterCallback callback = new InnerPrinterCallback() {
        @Override protected void onConnected(SunmiPrinterService s) { service = s; }
        @Override protected void onDisconnected() { service = null; }
    };

    public PrinterBridge(Context context) { this.context = context.getApplicationContext(); }

    public void connect() {
        try { InnerPrinterManager.getInstance().bindService(context, callback); }
        catch (InnerPrinterException e) { service = null; }
    }

    public void disconnect() {
        try { InnerPrinterManager.getInstance().unBindService(context, callback); }
        catch (InnerPrinterException ignored) { }
    }

    @JavascriptInterface
    public boolean isReady() { return service != null; }

    @JavascriptInterface
    public String print(String json) {
        SunmiPrinterService p = service;
        if (p == null) return "imprimante non connectée (redémarrez l'appli)";
        try {
            JSONObject r = new JSONObject(json);
            JSONObject e = r.getJSONObject("entreprise");

            p.printerInit(null);

            // En-tête
            p.setAlignment(1, null);
            p.sendRAWData(BOLD_ON, null);
            p.setFontSize(44, null); p.printText(e.getString("sigle") + "\n", null);
            p.sendRAWData(BOLD_OFF, null);
            p.setFontSize(20, null); p.printText(e.getString("nom") + "\n", null);
            p.sendRAWData(BOLD_ON, null);
            p.setFontSize(26, null); p.printText(e.getString("gerant") + "\n", null);
            p.sendRAWData(BOLD_OFF, null);
            p.setFontSize(20, null);
            p.printText(e.getString("tel") + "\n", null);
            p.printText(e.getString("lignes") + "\n", null);
            p.printText(e.getString("info") + "\n", null);
            p.printText(e.getString("adresse") + "\n", null);
            sep(p);

            p.sendRAWData(BOLD_ON, null);
            p.setFontSize(30, null); p.printText("REÇU DE TRANSPORT\n", null);
            p.sendRAWData(BOLD_OFF, null);

            // Détails
            p.setAlignment(0, null);
            p.setFontSize(22, null);
            cols(p, "N°", r.getString("num"));
            cols(p, "Date", r.optString("dateTxt"));
            sep(p);
            cols(p, "Nom", r.getString("nom"));
            cols(p, "Destination", r.optString("dest"));
            cols(p, "Tél. dest.", r.optString("tel"));
            cols(p, "Colis", r.getString("colis"));
            sep(p);

            p.sendRAWData(BOLD_ON, null);
            p.setFontSize(28, null);
            cols(p, "Somme", r.optString("sommeTxt") + " F CFA");
            p.sendRAWData(BOLD_OFF, null);
            p.setFontSize(18, null);
            p.printText("Arrêté à la somme de " + r.optString("lettres") + " francs CFA.\n\n", null);

            p.setAlignment(0, null);
            p.printText("--------------------------------\n", null);

            p.setAlignment(1, null);
            p.setFontSize(18, null);
            p.printText(e.optString("slogan", "") + "\nMerci de votre confiance.\nConservez ce reçu pour retirer vos colis.\n", null);
            p.lineWrap(4, null);
            return "ok";
        } catch (Exception ex) {
            return ex.getMessage() == null ? ex.toString() : ex.getMessage();
        }
    }

    private void sep(SunmiPrinterService p) throws Exception {
        p.setAlignment(0, null);
        p.setFontSize(22, null);
        p.printText("- - - - - - - - - - - - - - - -\n", null);
        p.setAlignment(1, null);
    }

    private void cols(SunmiPrinterService p, String label, String value) throws Exception {
        p.printColumnsString(new String[]{label, value}, new int[]{2, 3}, new int[]{0, 2}, null);
    }

    /** Image PNG en data URL → bitmap à la largeur du papier. */
    private Bitmap decode(String dataUrl) {
        if (dataUrl == null || !dataUrl.startsWith("data:image")) return null;
        try {
            byte[] bytes = Base64.decode(dataUrl.substring(dataUrl.indexOf(',') + 1), Base64.DEFAULT);
            Bitmap b = BitmapFactory.decodeByteArray(bytes, 0, bytes.length);
            if (b == null) return null;
            int h = Math.max(1, Math.round(b.getHeight() * (PAPER_DOTS / (float) b.getWidth())));
            return Bitmap.createScaledBitmap(b, PAPER_DOTS, Math.min(h, 160), true);
        } catch (Exception ex) {
            return null;
        }
    }
}
