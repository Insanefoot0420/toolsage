package com.toolsage.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.*
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.material3.MenuAnchorType
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.toolsage.ui.viewmodel.ToolSageViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SmartImportScreen(
    onNavigateBack: () -> Unit,
    onImportComplete: () -> Unit = {},
    viewModel: ToolSageViewModel = viewModel()
) {
    var inputText by remember { mutableStateOf("") }
    var sourceType by remember { mutableStateOf("plain_text") }
    var expandedDropdown by remember { mutableStateOf(false) }
    val isLoading by viewModel.isLoading.collectAsStateWithLifecycle()
    val importedTools by viewModel.importedTools.collectAsStateWithLifecycle()

    // Navigate to review when import results come in
    LaunchedEffect(importedTools) {
        if (importedTools.isNotEmpty()) {
            onImportComplete()
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Smart Import") },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, "Zpět", tint = MaterialTheme.colorScheme.onPrimary)
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.primary,
                    titleContentColor = MaterialTheme.colorScheme.onPrimary
                )
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier.fillMaxSize().padding(padding).verticalScroll(rememberScrollState()).padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.tertiaryContainer)) {
                Row(
                    modifier = Modifier.padding(16.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    Icon(Icons.Filled.AutoAwesome, "AI", tint = MaterialTheme.colorScheme.onTertiaryContainer, modifier = Modifier.size(32.dp))
                    Column {
                        Text("Inteligentní import nástrojů", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
                        Text("Vlož text a AI automaticky vytvoří záznamy nástrojů",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onTertiaryContainer.copy(alpha = 0.7f))
                    }
                }
            }

            // Source type
            ExposedDropdownMenuBox(expanded = expandedDropdown, onExpandedChange = { expandedDropdown = !expandedDropdown }) {
                OutlinedTextField(
                    value = when (sourceType) {
                        "plain_text" -> "Čistý text"; "markdown" -> "Markdown"
                        "docx" -> "DOCX dokument"; else -> sourceType
                    },
                    onValueChange = {}, readOnly = true, label = { Text("Typ zdroje") },
                    trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = expandedDropdown) },
                    modifier = Modifier.fillMaxWidth().menuAnchor(MenuAnchorType.PrimaryNotEditable, enabled = true),
                    leadingIcon = { Icon(
                        when (sourceType) {
                            "plain_text" -> Icons.Filled.TextFields; "markdown" -> Icons.Filled.Code
                            else -> Icons.Filled.Description
                        }, null)
                    }
                )
                ExposedDropdownMenu(expanded = expandedDropdown, onDismissRequest = { expandedDropdown = false }) {
                    listOf("plain_text" to "Čistý text", "markdown" to "Markdown", "docx" to "DOCX dokument").forEach { (value, label) ->
                        DropdownMenuItem(text = { Text(label) }, onClick = { sourceType = value; expandedDropdown = false })
                    }
                }
            }

            // Paste text
            Text("Vlož text k analýze:", style = MaterialTheme.typography.labelLarge, fontWeight = FontWeight.Medium)
            OutlinedTextField(
                value = inputText,
                onValueChange = { inputText = it },
                modifier = Modifier.fillMaxWidth().height(250.dp),
                placeholder = { Text("Sem vlož text obsahující informace o nástrojích...") },
                maxLines = 20
            )

            // Import button
            Button(
                onClick = { viewModel.runSmartImport(inputText, sourceType) },
                modifier = Modifier.fillMaxWidth(),
                enabled = inputText.isNotBlank() && !isLoading
            ) {
                if (isLoading) {
                    CircularProgressIndicator(modifier = Modifier.size(20.dp), strokeWidth = 2.dp, color = MaterialTheme.colorScheme.onPrimary)
                    Spacer(Modifier.width(8.dp))
                }
                Icon(Icons.Filled.AutoAwesome, null)
                Spacer(Modifier.width(8.dp))
                Text(if (isLoading) "Zpracovávám..." else "Spustit inteligentní import")
            }

            Spacer(Modifier.height(80.dp))
        }
    }
}
