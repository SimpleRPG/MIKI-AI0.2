package com.miki.ai;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(MikiWorkManagerPlugin.class);
        registerPlugin(MIKIJapaneseMorphologyPlugin.class);
        registerPlugin(MIKINativeRunnerPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
