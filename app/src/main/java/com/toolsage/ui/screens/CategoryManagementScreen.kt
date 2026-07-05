package com.toolsage.ui.screens

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.toolsage.data.model.Category
import com.toolsage.data.model.CreateCategoryRequest
import com.toolsage.data.remote.HttpClient
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CategoryManagementScreen(onNavigateBack: () -> Unit = {}) {
    val scope = rememberCoroutineScope()
    val snackbarState = remember { SnackbarHostState() }

    var categories by remember { mutableStateOf<List<Category>>(emptyList()) }
    var isLoading by remember { mutableStateOf(true) }
    var errorMsg by remember { mutableStateOf<String?>(null) }

    // Dialogs
    var showAddDialog by remember { mutableStateOf(false) }
    var showEditDialog by remember { mutableStateOf<Category?>(null) }
    var showDeleteConfirm by remember { mutableStateOf<Category?>(null) }

    fun loadCategories() {
        scope.launch {
            isLoading = true
            errorMsg = null
            try {
                val resp = HttpClient.apiService.getCategories()
                if (resp.isSuccessful) {
                    categories = resp.body() ?: emptyList()
                } else {
                    errorMsg = "Chyba: ${resp.code()}"
                }
            } catch (e: Exception) {
                errorMsg = "Chyba připojení: ${e.message}"
            } finally {
                isLoading = false
            }
        }
    }

    LaunchedEffect(Unit) { loadCategories() }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Správa kategorií") },
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
        floatingActionButton = {
            ExtendedFloatingActionButton(
                onClick = { showAddDialog = true },
                containerColor = MaterialTheme.colorScheme.tertiary
            ) {
                Icon(Icons.Filled.Add, null)
                Spacer(Modifier.width(8.dp))
                Text("Nová kategorie")
            }
        },
        snackbarHost = { SnackbarHost(snackbarState) }
    ) { padding ->
        when {
            isLoading -> {
                Box(Modifier.fillMaxSize().padding(padding), contentAlignment = Alignment.Center) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        CircularProgressIndicator()
                        Spacer(Modifier.height(16.dp))
                        Text("Načítám kategorie...")
                    }
                }
            }

            errorMsg != null -> {
                Box(Modifier.fillMaxSize().padding(padding), contentAlignment = Alignment.Center) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.padding(32.dp)) {
                        Icon(Icons.Filled.CloudOff, null, modifier = Modifier.size(64.dp),
                            tint = MaterialTheme.colorScheme.error.copy(alpha = 0.5f))
                        Spacer(Modifier.height(16.dp))
                        Text(errorMsg!!, style = MaterialTheme.typography.bodyMedium, textAlign = TextAlign.Center)
                        Spacer(Modifier.height(16.dp))
                        OutlinedButton(onClick = { loadCategories() }) { Text("Zkusit znovu") }
                    }
                }
            }

            else -> {
                LazyColumn(
                    modifier = Modifier.fillMaxSize().padding(padding),
                    contentPadding = PaddingValues(16.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    item {
                        Text(
                            "${categories.size} kategorií",
                            style = MaterialTheme.typography.titleSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                        Spacer(Modifier.height(4.dp))
                    }

                    items(categories, key = { it.name }) { cat ->
                        CategoryRow(
                            category = cat,
                            onEdit = { showEditDialog = cat },
                            onDelete = { showDeleteConfirm = cat }
                        )
                    }

                    item { Spacer(Modifier.height(80.dp)) }
                }
            }
        }
    }

    // ─── ADD DIALOG ────────────────────────────────────────
    if (showAddDialog) {
        CategoryEditDialog(
            title = "Nová kategorie",
            initialName = "",
            initialIcon = "📁",
            onDismiss = { showAddDialog = false },
            onSave = { name, icon ->
                scope.launch {
                    try {
                        val resp = HttpClient.apiService.createCategory(CreateCategoryRequest(name.trim(), icon))
                        if (resp.isSuccessful) {
                            snackbarState.showSnackbar("Kategorie '$name' vytvořena")
                            showAddDialog = false
                            loadCategories()
                        } else {
                            snackbarState.showSnackbar("Chyba: ${resp.code()} ${resp.message()}")
                        }
                    } catch (e: Exception) {
                        snackbarState.showSnackbar("Chyba: ${e.message}")
                    }
                }
            }
        )
    }

    // ─── EDIT DIALOG ───────────────────────────────────────
    showEditDialog?.let { cat ->
        CategoryEditDialog(
            title = "Upravit kategorii",
            initialName = cat.name,
            initialIcon = cat.icon,
            onDismiss = { showEditDialog = null },
            onSave = { newName, newIcon ->
                scope.launch {
                    try {
                        val updates = mutableMapOf<String, Any>()
                        if (newName.trim() != cat.name) updates["name"] = newName.trim()
                        if (newIcon != cat.icon) updates["icon"] = newIcon

                        if (updates.isNotEmpty()) {
                            val resp = HttpClient.apiService.updateCategory(cat.name, updates)
                            if (resp.isSuccessful) {
                                snackbarState.showSnackbar("Kategorie upravena")
                            } else {
                                snackbarState.showSnackbar("Chyba: ${resp.code()}")
                            }
                        }
                        showEditDialog = null
                        loadCategories()
                    } catch (e: Exception) {
                        snackbarState.showSnackbar("Chyba: ${e.message}")
                    }
                }
            }
        )
    }

    // ─── DELETE CONFIRM ────────────────────────────────────
    showDeleteConfirm?.let { cat ->
        AlertDialog(
            onDismissRequest = { showDeleteConfirm = null },
            icon = { Icon(Icons.Filled.Warning, null, tint = MaterialTheme.colorScheme.error) },
            title = { Text("Smazat kategorii?") },
            text = {
                Column {
                    Text("Kategorie '${cat.icon} ${cat.name}' bude smazána.")
                    Spacer(Modifier.height(12.dp))
                    Text("Co s nástroji v této kategorii?",
                        style = MaterialTheme.typography.labelMedium, fontWeight = FontWeight.SemiBold)
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        scope.launch {
                            try {
                                val resp = HttpClient.apiService.deleteCategory(cat.name, "none")
                                if (resp.isSuccessful || resp.code() == 200) {
                                    snackbarState.showSnackbar("Kategorie smazána")
                                }
                                showDeleteConfirm = null
                                loadCategories()
                            } catch (e: Exception) {
                                snackbarState.showSnackbar("Chyba: ${e.message}")
                            }
                        }
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.error)
                ) { Text("Smazat (nástroje zůstanou bez kategorie)") }
            },
            dismissButton = {
                TextButton(onClick = { showDeleteConfirm = null }) { Text("Zrušit") }
            }
        )
    }
}

// ═══════════════════════════════════════════════════════════════
// CATEGORY ROW
// ═══════════════════════════════════════════════════════════════

@Composable
fun CategoryRow(
    category: Category,
    onEdit: () -> Unit,
    onDelete: () -> Unit
) {
    Card(modifier = Modifier.fillMaxWidth()) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Text(category.icon, style = MaterialTheme.typography.headlineMedium)
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    category.name,
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.SemiBold
                )
                Text(
                    "Pořadí: ${category.sort_order}",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
            IconButton(onClick = onEdit) {
                Icon(Icons.Filled.Edit, "Upravit",
                    tint = MaterialTheme.colorScheme.primary)
            }
            IconButton(onClick = onDelete) {
                Icon(Icons.Filled.Delete, "Smazat",
                    tint = MaterialTheme.colorScheme.error)
            }
        }
    }
}

// ═══════════════════════════════════════════════════════════════
// CATEGORY EDIT DIALOG
// ═══════════════════════════════════════════════════════════════

@Composable
fun CategoryEditDialog(
    title: String,
    initialName: String,
    initialIcon: String,
    onDismiss: () -> Unit,
    onSave: (String, String) -> Unit
) {
    var name by remember { mutableStateOf(initialName) }
    var icon by remember { mutableStateOf(initialIcon) }
    var showEmojiPicker by remember { mutableStateOf(false) }

    val emojiOptions = listOf(
        "💻", "🤖", "🎨", "⚙️", "🖥️", "🌐", "🗄️", "🔒", "☁️", "📱",
        "📊", "🔧", "🎯", "🧪", "📦", "🚀", "💾", "🛠️", "📡", "🔬",
        "🎮", "📷", "🎵", "📚", "💰", "🏗️", "🧩", "⚡", "🔄", "📁"
    )

    AlertDialog(
        onDismissRequest = onDismiss,
        title = {
            Text(title, modifier = Modifier.fillMaxWidth(), textAlign = TextAlign.Center)
        },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                OutlinedTextField(
                    value = name,
                    onValueChange = { name = it },
                    label = { Text("Název kategorie") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )

                Text("Ikona:", style = MaterialTheme.typography.labelMedium)
                Text(icon, style = MaterialTheme.typography.headlineLarge,
                    modifier = Modifier.clickable { showEmojiPicker = !showEmojiPicker })

                if (showEmojiPicker) {
                    Surface(
                        color = MaterialTheme.colorScheme.surfaceVariant,
                        shape = RoundedCornerShape(12.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Column(modifier = Modifier.padding(8.dp)) {
                            // Emoji grid
                            emojiOptions.chunked(6).forEach { row ->
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.SpaceEvenly
                                ) {
                                    row.forEach { emoji ->
                                        Text(
                                            emoji,
                                            style = MaterialTheme.typography.headlineSmall,
                                            modifier = Modifier
                                                .clickable {
                                                    icon = emoji
                                                    showEmojiPicker = false
                                                }
                                                .padding(4.dp)
                                        )
                                    }
                                }
                            }
                        }
                    }
                }
            }
        },
        confirmButton = {
            Button(
                onClick = { onSave(name, icon) },
                enabled = name.isNotBlank()
            ) { Text("Uložit") }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text("Zrušit") }
        }
    )
}


