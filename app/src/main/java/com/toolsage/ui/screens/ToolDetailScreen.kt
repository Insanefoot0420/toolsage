package com.toolsage.ui.screens

import android.content.Intent
import android.os.Environment
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material.icons.automirrored.filled.TextSnippet
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.core.content.FileProvider
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.toolsage.data.model.Agent
import com.toolsage.data.model.AgentListResponse
import com.toolsage.data.model.SendToAgentRequest
import com.toolsage.data.model.Tool
import com.toolsage.data.remote.HttpClient
import com.toolsage.ui.viewmodel.ToolSageViewModel
import androidx.compose.foundation.clickable
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.File

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ToolDetailScreen(
    toolId: String,
    onNavigateBack: () -> Unit,
    viewModel: ToolSageViewModel = viewModel()
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val snackbarState = remember { SnackbarHostState() }

    LaunchedEffect(toolId) { viewModel.loadToolDetail(toolId) }

    val tool by viewModel.selectedTool.collectAsStateWithLifecycle()
    val isLoading by viewModel.isLoading.collectAsStateWithLifecycle()

    // Dialogs
    var showExportDialog by remember { mutableStateOf(false) }
    var showSendDialog by remember { mutableStateOf(false) }
    var isExporting by remember { mutableStateOf(false) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(tool?.name ?: "Detail nástroje") },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, "Zpět",
                            tint = MaterialTheme.colorScheme.onPrimary)
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.primary,
                    titleContentColor = MaterialTheme.colorScheme.onPrimary
                )
            )
        },
        bottomBar = {
            if (tool != null) {
                Surface(
                    shadowElevation = 8.dp,
                    color = MaterialTheme.colorScheme.surface
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 16.dp, vertical = 12.dp),
                        horizontalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        // Export button
                        OutlinedButton(
                            onClick = { showExportDialog = true },
                            modifier = Modifier.weight(1f)
                        ) {
                            Icon(Icons.Filled.FileDownload, null, modifier = Modifier.size(18.dp))
                            Spacer(Modifier.width(4.dp))
                            Text("Exportovat")
                        }

                        // Send to agent button
                        Button(
                            onClick = { showSendDialog = true },
                            modifier = Modifier.weight(1f)
                        ) {
                            Icon(Icons.AutoMirrored.Filled.Send, null, modifier = Modifier.size(18.dp))
                            Spacer(Modifier.width(4.dp))
                            Text("Odeslat agentovi")
                        }
                    }
                }
            }
        },
        snackbarHost = { SnackbarHost(snackbarState) }
    ) { padding ->
        if (isLoading) {
            Box(modifier = Modifier.fillMaxSize().padding(padding), contentAlignment = Alignment.Center) {
                CircularProgressIndicator()
            }
        } else if (tool == null) {
            Box(modifier = Modifier.fillMaxSize().padding(padding), contentAlignment = Alignment.Center) {
                Text("Nástroj nenalezen")
            }
        } else {
            val t = tool!!
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(padding)
                    .verticalScroll(rememberScrollState())
                    .padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                // ═══════════════ NAME + RATING ═══════════════
                Card(modifier = Modifier.fillMaxWidth()) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(t.name, style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
                            Surface(
                                shape = MaterialTheme.shapes.small,
                                color = when (t.pricingModel) {
                                    "free" -> MaterialTheme.colorScheme.primaryContainer
                                    "open_source" -> MaterialTheme.colorScheme.tertiaryContainer
                                    else -> MaterialTheme.colorScheme.secondaryContainer
                                }
                            ) {
                                Text(
                                    when (t.pricingModel) {
                                        "free" -> "💚 Zdarma"; "freemium" -> "💛 Freemium"
                                        "paid" -> "💜 Placené"; "open_source" -> "💙 Open Source"
                                        else -> t.pricingModel
                                    },
                                    modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
                                    style = MaterialTheme.typography.labelMedium, fontWeight = FontWeight.Medium
                                )
                            }
                        }
                        if (t.averageRating > 0) {
                            Spacer(Modifier.height(8.dp))
                            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                                Icon(Icons.Filled.Star, null, modifier = Modifier.size(20.dp), tint = MaterialTheme.colorScheme.tertiary)
                                Text(String.format("%.1f", t.averageRating), style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                                Text("(${t.reviewCount} recenzí)", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            }
                        }
                    }
                }

                // ═══════════════ DESCRIPTION ═══════════════
                if (t.description.isNotBlank()) {
                    Text("Popis", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
                    Text(t.description, style = MaterialTheme.typography.bodyMedium)
                }

                // ═══════════════ CATEGORIES + TAGS ═══════════════
                if (t.categories.isNotEmpty() || t.tags.isNotEmpty()) {
                    Card(modifier = Modifier.fillMaxWidth()) {
                        Column(modifier = Modifier.padding(16.dp)) {
                            if (t.categories.isNotEmpty()) {
                                Text("Kategorie", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                                Spacer(Modifier.height(4.dp))
                                Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                                    t.categories.forEach { cat ->
                                        FilterChip(selected = true, onClick = {}, label = { Text(cat) })
                                    }
                                }
                            }
                            if (t.tags.isNotEmpty()) {
                                Spacer(Modifier.height(8.dp))
                                Text("Tagy", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                                Spacer(Modifier.height(4.dp))
                                Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                                    t.tags.forEach { tag ->
                                        SuggestionChip(onClick = {}, label = { Text(tag) })
                                    }
                                }
                            }
                        }
                    }
                }

                // ═══════════════ COMPATIBILITY ═══════════════
                if (t.compatibility.os.isNotEmpty() || t.compatibility.platforms.isNotEmpty()) {
                    Card(modifier = Modifier.fillMaxWidth()) {
                        Column(modifier = Modifier.padding(16.dp)) {
                            Text("Kompatibilita", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
                            if (t.compatibility.os.isNotEmpty()) {
                                Spacer(Modifier.height(4.dp))
                                Text("OS: ${t.compatibility.os.joinToString(", ")}", style = MaterialTheme.typography.bodyMedium)
                            }
                            if (t.compatibility.platforms.isNotEmpty()) {
                                Spacer(Modifier.height(4.dp))
                                Text("Platformy: ${t.compatibility.platforms.joinToString(", ")}", style = MaterialTheme.typography.bodyMedium)
                            }
                        }
                    }
                }

                // ═══════════════ SETUP GUIDES ═══════════════
                if (t.setupGuides.isNotBlank()) {
                    Card(modifier = Modifier.fillMaxWidth()) {
                        Column(modifier = Modifier.padding(16.dp)) {
                            Text("Návody k zprovoznění", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
                            Spacer(Modifier.height(8.dp))
                            Text(t.setupGuides, style = MaterialTheme.typography.bodyMedium)
                        }
                    }
                }

                Spacer(Modifier.height(88.dp)) // space for bottom bar
            }
        }
    }

    // ═══════════════════════════════════════════════════════
    // EXPORT DIALOG
    // ═══════════════════════════════════════════════════════
    if (showExportDialog && tool != null) {
        var selectedFormat by remember { mutableStateOf("txt") }
        AlertDialog(
            onDismissRequest = { showExportDialog = false },
            icon = { Icon(Icons.Filled.FileDownload, null, tint = MaterialTheme.colorScheme.primary) },
            title = { Text("Exportovat kartu nástroje", textAlign = TextAlign.Center, modifier = Modifier.fillMaxWidth()) },
            text = {
                Column(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    Text("Vyber formát exportu:", style = MaterialTheme.typography.bodyMedium)

                    Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                        FilterChip(
                            selected = selectedFormat == "txt",
                            onClick = { selectedFormat = "txt" },
                            label = { Text(".txt") },
                            leadingIcon = { Icon(Icons.AutoMirrored.Filled.TextSnippet, null, modifier = Modifier.size(18.dp)) }
                        )
                        FilterChip(
                            selected = selectedFormat == "md",
                            onClick = { selectedFormat = "md" },
                            label = { Text(".md") },
                            leadingIcon = { Icon(Icons.Filled.Code, null, modifier = Modifier.size(18.dp)) }
                        )
                    }

                    Spacer(Modifier.height(4.dp))

                    Text(
                        when (selectedFormat) {
                            "txt" -> "Prostý text — univerzální formát čitelný na všech zařízeních"
                            "md" -> "Markdown — formátovaný text s nadpisy a tabulkou"
                            else -> ""
                        },
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )

                    if (isExporting) {
                        LinearProgressIndicator(modifier = Modifier.fillMaxWidth())
                    }
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        isExporting = true
                        scope.launch {
                            try {
                                val format = selectedFormat
                                val resp = HttpClient.apiService.exportTool(tool!!.id, format)

                                if (resp.isSuccessful) {
                                    val body = withContext(Dispatchers.IO) {
                                        resp.body()?.string() ?: ""
                                    }

                                    val fileName = "toolsage-${tool!!.id}.$format"
                                    val file = withContext(Dispatchers.IO) {
                                        val dir = context.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS)
                                        File(dir, fileName).also { it.writeText(body) }
                                    }

                                    snackbarState.showSnackbar("Uloženo: $fileName")

                                    val shareIntent = Intent(Intent.ACTION_SEND).apply {
                                        type = if (format == "md") "text/markdown" else "text/plain"
                                        putExtra(Intent.EXTRA_STREAM, FileProvider.getUriForFile(
                                            context, "${context.packageName}.fileprovider", file
                                        ))
                                        putExtra(Intent.EXTRA_SUBJECT, "ToolSage: ${tool!!.name}")
                                        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                                    }
                                    context.startActivity(Intent.createChooser(shareIntent, "Sdílet kartu nástroje"))
                                } else {
                                    snackbarState.showSnackbar("Chyba exportu: ${resp.code()}")
                                }
                            } catch (e: Exception) {
                                snackbarState.showSnackbar("Chyba: ${e.message}")
                            } finally {
                                isExporting = false
                                showExportDialog = false
                            }
                        }
                    },
                    enabled = !isExporting
                ) {
                    if (isExporting) {
                        CircularProgressIndicator(modifier = Modifier.size(16.dp), strokeWidth = 2.dp)
                        Spacer(Modifier.width(8.dp))
                    }
                    Text("Stáhnout a sdílet")
                }
            },
            dismissButton = {
                TextButton(onClick = { showExportDialog = false }) { Text("Zrušit") }
            }
        )
    }

    // ═══════════════════════════════════════════════════════
    // SEND TO AGENT DIALOG
    // ═══════════════════════════════════════════════════════
    if (showSendDialog && tool != null) {
        SendToAgentDialog(
            tool = tool!!,
            onDismiss = { showSendDialog = false },
            onSent = { agentName ->
                showSendDialog = false
                scope.launch {
                    snackbarState.showSnackbar("Karta odeslána agentovi $agentName")
                }
            },
            snackbarState = snackbarState
        )
    }
}

// ═══════════════════════════════════════════════════════════════
// SEND TO AGENT DIALOG
// ═══════════════════════════════════════════════════════════════

@Composable
fun SendToAgentDialog(
    tool: Tool,
    onDismiss: () -> Unit,
    onSent: (String) -> Unit,
    snackbarState: SnackbarHostState
) {
    val scope = rememberCoroutineScope()
    var agents by remember { mutableStateOf<List<Agent>>(emptyList()) }
    var loading by remember { mutableStateOf(true) }
    var sending by remember { mutableStateOf(false) }
    var selectedAgent by remember { mutableStateOf<String?>(null) }
    var message by remember { mutableStateOf("") }

    LaunchedEffect(Unit) {
        try {
            val resp = HttpClient.apiService.getAgents()
            if (resp.isSuccessful) {
                agents = resp.body()?.agents?.filter { it.active } ?: emptyList()
            }
        } catch (_: Exception) { }
        loading = false
    }

    AlertDialog(
        onDismissRequest = onDismiss,
        icon = { Icon(Icons.AutoMirrored.Filled.Send, null, tint = MaterialTheme.colorScheme.primary) },
        title = { Text("Odeslat kartu agentovi", textAlign = TextAlign.Center, modifier = Modifier.fillMaxWidth()) },
        text = {
            Column(
                modifier = Modifier.fillMaxWidth(),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                // Tool info preview
                Surface(
                    color = MaterialTheme.colorScheme.surfaceVariant,
                    shape = RoundedCornerShape(8.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(modifier = Modifier.padding(12.dp)) {
                        Text(tool.name, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold)
                        Text(tool.description.take(100) + if (tool.description.length > 100) "..." else "",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                }

                Text("Vyber agenta:", style = MaterialTheme.typography.labelLarge, fontWeight = FontWeight.SemiBold)

                // Agent list
                when {
                    loading -> LinearProgressIndicator(modifier = Modifier.fillMaxWidth())
                    agents.isEmpty() -> {
                        Text("Žádní aktivní agenti. Vytvoř agenta v Agent Hub.",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.error)
                    }
                    else -> {
                        agents.forEach { agent ->
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clickable { selectedAgent = agent.id }
                                    .padding(vertical = 4.dp),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(12.dp)
                            ) {
                                RadioButton(
                                    selected = selectedAgent == agent.id,
                                    onClick = { selectedAgent = agent.id }
                                )
                                Icon(
                                    Icons.Filled.SmartToy,
                                    null,
                                    tint = MaterialTheme.colorScheme.primary,
                                    modifier = Modifier.size(24.dp)
                                )
                                Column(modifier = Modifier.weight(1f)) {
                                    Text(agent.name, style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.Medium)
                                    Text(agent.description.take(50), style = MaterialTheme.typography.bodySmall,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant)
                                }
                            }
                        }
                    }
                }

                // Optional message
                OutlinedTextField(
                    value = message,
                    onValueChange = { message = it },
                    label = { Text("Zpráva pro agenta (volitelná)") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )

                if (sending) {
                    LinearProgressIndicator(modifier = Modifier.fillMaxWidth())
                }
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    if (selectedAgent == null) return@Button
                    sending = true
                    scope.launch {
                        try {
                            val resp = HttpClient.apiService.sendToolToAgent(
                                tool.id,
                                SendToAgentRequest(selectedAgent!!, message.trim())
                            )
                            if (resp.isSuccessful) {
                                val agentName = agents.find { it.id == selectedAgent }?.name ?: selectedAgent!!
                                onSent(agentName)
                            } else {
                                snackbarState.showSnackbar("Chyba: ${resp.code()}")
                                sending = false
                            }
                        } catch (e: Exception) {
                            snackbarState.showSnackbar("Chyba: ${e.message}")
                            sending = false
                        }
                    }
                },
                enabled = selectedAgent != null && !sending
            ) {
                if (sending) {
                    CircularProgressIndicator(modifier = Modifier.size(16.dp), strokeWidth = 2.dp, color = MaterialTheme.colorScheme.onPrimary)
                    Spacer(Modifier.width(8.dp))
                }
                Text("Odeslat")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss, enabled = !sending) { Text("Zrušit") }
        }
    )
}


