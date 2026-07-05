package com.toolsage.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.*
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
fun ToolDetailScreen(
    toolId: String,
    onNavigateBack: () -> Unit,
    viewModel: ToolSageViewModel = viewModel()
) {
    LaunchedEffect(toolId) {
        viewModel.loadToolDetail(toolId)
    }

    val tool by viewModel.selectedTool.collectAsStateWithLifecycle()
    val isLoading by viewModel.isLoading.collectAsStateWithLifecycle()

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(tool?.name ?: "Detail nástroje") },
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
                modifier = Modifier.fillMaxSize().padding(padding).verticalScroll(rememberScrollState()).padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                // Name and rating
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
                                    else -> MaterialTheme.colorScheme.secondaryContainer
                                }
                            ) {
                                Text(
                                    when (t.pricingModel) {
                                        "free" -> "Zdarma"; "freemium" -> "Freemium"
                                        "paid" -> "Placené"; "open_source" -> "Open Source"
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

                // Description
                if (t.description.isNotBlank()) {
                    Text("Popis", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
                    Text(t.description, style = MaterialTheme.typography.bodyMedium)
                }

                // Categories and tags
                if (t.categories.isNotEmpty() || t.tags.isNotEmpty()) {
                    Card(modifier = Modifier.fillMaxWidth()) {
                        Column(modifier = Modifier.padding(16.dp)) {
                            if (t.categories.isNotEmpty()) {
                                Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                                    t.categories.forEach { cat ->
                                        FilterChip(selected = true, onClick = {}, label = { Text(cat) })
                                    }
                                }
                            }
                            if (t.tags.isNotEmpty()) {
                                Spacer(Modifier.height(8.dp))
                                Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                                    t.tags.forEach { tag ->
                                        SuggestionChip(onClick = {}, label = { Text(tag) })
                                    }
                                }
                            }
                        }
                    }
                }

                // Compatibility
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

                // Setup guides
                if (t.setupGuides.isNotBlank()) {
                    Text("Návody k zprovoznění", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
                    Text(t.setupGuides, style = MaterialTheme.typography.bodyMedium)
                }

                Spacer(Modifier.height(80.dp))
            }
        }
    }
}
