package com.toolsage

import android.app.Application

class ToolSageApp : Application() {
    override fun onCreate() {
        super.onCreate()
        instance = this
    }

    companion object {
        lateinit var instance: ToolSageApp
            private set
    }
}
