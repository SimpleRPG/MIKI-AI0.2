package com.miki.ai;

import com.getcapacitor.BridgeActivity;
import com.miki.ai.MikiWorkManagerPlugin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(android.os.Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        registerPlugin(MikiWorkManagerPlugin.class);
    }}
