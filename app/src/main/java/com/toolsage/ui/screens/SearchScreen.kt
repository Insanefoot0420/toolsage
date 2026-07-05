package com.toolsage.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.toolsage.data.model.Tool

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SearchScreen() {
    var searchQuery by remember { mutableStateOf("") }
    var searchHistory by remember {
        mutableStateOf(
            listOf("Android Studio", "Firebase", "Figma", "Docker", "GitHub Copilot")
        )
    }
    var recentSearches by remember {
        mutableStateOf(
            listOf("AI nástroje", "design UI", "backend platformy")
        )
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Vyhledávání") },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.primary,
                    titleContentColor = MaterialTheme.colorScheme.onPrimary
                )
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
        ) {
            // Search bar
            OutlinedTextField(
                value = searchQuery,
                onValueChange = { searchQuery = it },
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(16.dp),
                placeholder = { Text("Hledat nástroje, kategorie, tagy…") },
                leadingIcon = { Icon(Icons.Filled.Search, null) },
                trailingIcon = {
                    if (searchQuery.isNotEmpty()) {
                        IconButton(onClick = { searchQuery = "" }) {
                            Icon(Icons.Filled.Clear, "Vymazat")
                        }
                    }
                },
                singleLine = true,
                shape = MaterialTheme.shapes.extraLarge
            )

            if (searchQuery.isBlank()) {
                // Show search history and suggestions
                LazyColumn(
                    modifier = Modifier.fillMaxSize(),
                    contentPadding = PaddingValues(horizontal = 16.dp)
                ) {
                    // Recent searches
                    item {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Text(
                                "Nedávná hledání",
                                style = MaterialTheme.typography.titleSmall,
                                fontWeight = FontWeight.SemiBold
                            )
                            TextButton(onClick = { recentSearches = emptyList() }) {
                                Text("Vymazat", style = MaterialTheme.typography.labelSmall)
                            }
                        }
                    }

                    items(recentSearches) { search ->
                        NavigationDrawerItem(
                            icon = { Icon(Icons.Filled.History, null, modifier = Modifier.size(20.dp)) },
                            label = { Text(search) },
                            selected = false,
                            onClick = { searchQuery = search },
                            modifier = Modifier.fillMaxWidth()
                        )
                    }

                    item { Spacer(Modifier.height(16.dp)) }

                    // Popular tools
                    item {
                        Text(
                            "Populární nástroje",
                            style = MaterialTheme.typography.titleSmall,
                            fontWeight = FontWeight.SemiBold
                        )
                        Spacer(Modifier.height(8.dp))
                    }

                    items(searchHistory) { tool ->
                        NavigationDrawerItem(
                            icon = {
                                Icon(Icons.Filled.TrendingUp, null, modifier = Modifier.size(20.dp),
                                    tint = MaterialTheme.colorScheme.primary)
                            },
                            label = { Text(tool) },
                            selected = false,
                            onClick = { searchQuery = tool },
                            modifier = Modifier.fillMaxWidth()
                        )
                    }
                }
            } else {
                // Search results placeholder
                LazyColumn(
                    modifier = Modifier.fillMaxSize(),
                    contentPadding = PaddingValues(16.dp)
                ) {
                    item {
                        Text(
                            "Výsledky pro: \"$searchQuery\"",
                            style = MaterialTheme.typography.titleSmall,
                            fontWeight = FontWeight.SemiBold
                        )
                        Spacer(Modifier.height(8.dp))
                        Text(
                            "Funkce vyhledávání bude dostupná po připojení k backendu.",
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
            }
        }
    }
}
