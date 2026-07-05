package com.toolsage.ui.screens

import androidx.compose.animation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
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
fun SmartImportReviewScreen(
    onNavigateBack: () -> Unit,
    viewModel: ToolSageViewModel = viewModel()
) {
    val importedTools by viewModel.importedTools.collectAsStateWithLifecycle()
    val isLoading by viewModel.isLoading.collectAsStateWithLifecycle()

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Revize importu") },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(Icons.Filled.Close, "Zrušit", tint = MaterialTheme.colorScheme.onPrimary)
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.primary,
                    titleContentColor = MaterialTheme.colorScheme.onPrimary
                )
            )
        },
        bottomBar = {
            Surface(shadowElevation = 8.dp) {
                Row(
                    modifier = Modifier.fillMaxWidth().padding(16.dp),
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    OutlinedButton(
                        onClick = onNavigateBack,
                        modifier = Modifier.weight(1f)
                    ) { Text("Zrušit import") }
                    Button(
                        onClick = {
                            viewModel.saveAcceptedImports { onNavigateBack() }
                        },
                        modifier = Modifier.weight(1f),
                        enabled = importedTools.any { it.accepted } && !isLoading
                    ) {
                        if (isLoading) {
                            CircularProgressIndicator(modifier = Modifier.size(20.dp), strokeWidth = 2.dp,
                                color = MaterialTheme.colorScheme.onPrimary)
                            Spacer(Modifier.width(8.dp))
                        }
                        Text("Uložit vybrané (${importedTools.count { it.accepted }})")
                    }
                }
            }
        }
    ) { padding ->
        if (importedTools.isEmpty()) {
            Box(modifier = Modifier.fillMaxSize().padding(padding), contentAlignment = Alignment.Center) {
                Text("Žádné nástroje k revizi")
            }
        } else {
            LazyColumn(
                modifier = Modifier.fillMaxSize().padding(padding),
                contentPadding = PaddingValues(16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                itemsIndexed(importedTools) { index, item ->
                    Card(
                        colors = CardDefaults.cardColors(
                            containerColor = if (item.accepted) MaterialTheme.colorScheme.surface
                                            else MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f)
                        )
                    ) {
                        Column(modifier = Modifier.padding(16.dp)) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                                ) {
                                    Icon(Icons.Filled.AutoAwesome, null,
                                        tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(20.dp))
                                    Text(item.tool.name.ifBlank { "Neznámý nástroj" },
                                        style = MaterialTheme.typography.titleMedium,
                                        fontWeight = FontWeight.SemiBold)
                                }
                                Switch(
                                    checked = item.accepted,
                                    onCheckedChange = { viewModel.toggleImportAcceptance(index) }
                                )
                            }

                            Spacer(Modifier.height(8.dp))

                            // Confidence score
                            LinearProgressIndicator(
                                progress = { (item.confidenceScore / 100f).toFloat() },
                                modifier = Modifier.fillMaxWidth(),
                                color = when {
                                    item.confidenceScore >= 70 -> MaterialTheme.colorScheme.primary
                                    item.confidenceScore >= 40 -> MaterialTheme.colorScheme.tertiary
                                    else -> MaterialTheme.colorScheme.error
                                }
                            )
                            Text("Spolehlivost: ${item.confidenceScore.toInt()}%",
                                style = MaterialTheme.typography.labelSmall)

                            if (item.tool.description.isNotBlank()) {
                                Spacer(Modifier.height(4.dp))
                                Text(item.tool.description, style = MaterialTheme.typography.bodySmall,
                                    maxLines = 3)
                            }

                            if (item.sourceContext.isNotBlank()) {
                                Spacer(Modifier.height(4.dp))
                                Text("Kontext: \"${item.sourceContext.take(100)}...\"",
                                    style = MaterialTheme.typography.labelSmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.6f))
                            }
                        }
                    }
                }
            }
        }
    }
}
