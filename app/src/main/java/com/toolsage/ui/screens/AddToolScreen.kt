package com.toolsage.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.material3.MenuAnchorType
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.toolsage.data.model.Tool
import com.toolsage.ui.viewmodel.ToolSageViewModel

@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)
@Composable
fun AddToolScreen(
    onNavigateBack: () -> Unit,
    existingToolId: String? = null,
    viewModel: ToolSageViewModel = viewModel()
) {
    var name by remember { mutableStateOf("") }
    var description by remember { mutableStateOf("") }
    var setupGuides by remember { mutableStateOf("") }
    var selectedCategories by remember { mutableStateOf<List<String>>(emptyList()) }
    var tags by remember { mutableStateOf<List<String>>(emptyList()) }
    var newTag by remember { mutableStateOf("") }
    var pricingModel by remember { mutableStateOf("free") }
    var selectedOS by remember { mutableStateOf<List<String>>(emptyList()) }
    var selectedPlatforms by remember { mutableStateOf<List<String>>(emptyList()) }
    var isSaving by remember { mutableStateOf(false) }

    val categories by viewModel.categories.collectAsStateWithLifecycle()

    val pricingModels = listOf("free", "freemium", "paid", "open_source")
    val osOptions = listOf("Windows", "macOS", "Linux", "Android", "iOS")
    val platformOptions = listOf("Web", "Desktop", "Mobile", "CLI")

    var categoryExpanded by remember { mutableStateOf(false) }
    var pricingExpanded by remember { mutableStateOf(false) }

    // Load existing tool for editing
    LaunchedEffect(existingToolId) {
        if (existingToolId != null) {
            viewModel.loadToolDetail(existingToolId)
        }
    }

    val isLoading by viewModel.isLoading.collectAsStateWithLifecycle()

    fun saveTool() {
        if (name.isBlank()) return
        isSaving = true
        val tool = Tool(
            name = name.trim(),
            description = description.trim(),
            categories = selectedCategories,
            tags = tags,
            setupGuides = setupGuides.trim(),
            pricingModel = pricingModel,
            compatibility = com.toolsage.data.model.Compatibility(
                os = selectedOS,
                platforms = selectedPlatforms
            ),
            status = "published"
        )
        viewModel.createTool(tool) {
            isSaving = false
            onNavigateBack()
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(if (existingToolId != null) "Upravit nástroj" else "Přidat nový nástroj") },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(Icons.Filled.Close, "Zrušit")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.primary,
                    titleContentColor = MaterialTheme.colorScheme.onPrimary,
                    navigationIconContentColor = MaterialTheme.colorScheme.onPrimary
                )
            )
        }
    ) { padding ->
        LazyColumn(
            modifier = Modifier.fillMaxSize().padding(padding),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // Name
            item {
                OutlinedTextField(
                    value = name, onValueChange = { name = it },
                    label = { Text("Název nástroje *") }, modifier = Modifier.fillMaxWidth(),
                    singleLine = true, isError = name.isBlank()
                )
            }

            // Categories
            item {
                ExposedDropdownMenuBox(expanded = categoryExpanded, onExpandedChange = { categoryExpanded = !categoryExpanded }) {
                    val catText = if (selectedCategories.isEmpty()) "Vyberte kategorie" else selectedCategories.joinToString(", ")
                    OutlinedTextField(
                        value = catText, onValueChange = {}, readOnly = true,
                        label = { Text("Kategorie") },
                        trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = categoryExpanded) },
                        modifier = Modifier.fillMaxWidth().menuAnchor(MenuAnchorType.PrimaryNotEditable, enabled = true)
                    )
                    ExposedDropdownMenu(expanded = categoryExpanded, onDismissRequest = { categoryExpanded = false }) {
                        categories.forEach { category ->
                            val isChecked = category in selectedCategories
                            DropdownMenuItem(
                                text = {
                                    Row(verticalAlignment = Alignment.CenterVertically) {
                                        Checkbox(checked = isChecked, onCheckedChange = null)
                                        Text(category)
                                    }
                                },
                                onClick = {
                                    selectedCategories = if (isChecked) selectedCategories - category else selectedCategories + category
                                }
                            )
                        }
                    }
                }
            }

            if (selectedCategories.isNotEmpty()) {
                item {
                    FlowRow(horizontalArrangement = Arrangement.spacedBy(4.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        selectedCategories.forEach { cat ->
                            InputChip(selected = false, onClick = { selectedCategories = selectedCategories - cat },
                                label = { Text(cat) }, trailingIcon = { Icon(Icons.Filled.Close, "Odebrat") })
                        }
                    }
                }
            }

            // Tags
            item {
                Column {
                    OutlinedTextField(
                        value = newTag, onValueChange = { newTag = it },
                        label = { Text("Přidat tag") }, modifier = Modifier.fillMaxWidth(),
                        singleLine = true, keyboardOptions = KeyboardOptions(imeAction = ImeAction.Done),
                        trailingIcon = {
                            if (newTag.isNotBlank()) {
                                IconButton(onClick = { tags = tags + newTag.trim(); newTag = "" }) {
                                    Icon(Icons.Filled.Add, "Přidat tag")
                                }
                            }
                        }
                    )
                    if (tags.isNotEmpty()) {
                        Spacer(Modifier.height(8.dp))
                        FlowRow(horizontalArrangement = Arrangement.spacedBy(4.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                            tags.forEach { tag ->
                                InputChip(selected = false, onClick = { tags = tags - tag },
                                    label = { Text(tag) }, trailingIcon = { Icon(Icons.Filled.Close, "Odebrat") })
                            }
                        }
                    }
                }
            }

            // Description
            item {
                OutlinedTextField(
                    value = description, onValueChange = { description = it },
                    label = { Text("Popis") }, modifier = Modifier.fillMaxWidth().height(150.dp),
                    maxLines = 10, supportingText = { Text("Podporuje Markdown") }
                )
            }

            // Setup guides
            item {
                OutlinedTextField(
                    value = setupGuides, onValueChange = { setupGuides = it },
                    label = { Text("Návody k zprovoznění") }, modifier = Modifier.fillMaxWidth().height(150.dp),
                    maxLines = 10, supportingText = { Text("Podporuje Markdown") }
                )
            }

            // Compatibility
            item {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f))
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Text("Kompatibilita", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
                        Spacer(Modifier.height(8.dp))
                        Text("Operační systémy:", style = MaterialTheme.typography.labelMedium)
                        Spacer(Modifier.height(4.dp))
                        FlowRow(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                            osOptions.forEach { os ->
                                FilterChip(selected = os in selectedOS,
                                    onClick = { selectedOS = if (os in selectedOS) selectedOS - os else selectedOS + os },
                                    label = { Text(os) })
                            }
                        }
                        Spacer(Modifier.height(8.dp))
                        Text("Platformy:", style = MaterialTheme.typography.labelMedium)
                        Spacer(Modifier.height(4.dp))
                        FlowRow(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                            platformOptions.forEach { platform ->
                                FilterChip(selected = platform in selectedPlatforms,
                                    onClick = { selectedPlatforms = if (platform in selectedPlatforms) selectedPlatforms - platform else selectedPlatforms + platform },
                                    label = { Text(platform) })
                            }
                        }
                    }
                }
            }

            // Pricing
            item {
                ExposedDropdownMenuBox(expanded = pricingExpanded, onExpandedChange = { pricingExpanded = !pricingExpanded }) {
                    OutlinedTextField(
                        value = pricingModel, onValueChange = {}, readOnly = true,
                        label = { Text("Cenový model") },
                        trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = pricingExpanded) },
                        modifier = Modifier.fillMaxWidth().menuAnchor(MenuAnchorType.PrimaryNotEditable, enabled = true)
                    )
                    ExposedDropdownMenu(expanded = pricingExpanded, onDismissRequest = { pricingExpanded = false }) {
                        pricingModels.forEach { model ->
                            DropdownMenuItem(
                                text = {
                                    Text(when (model) {
                                        "free" -> "Zdarma"; "freemium" -> "Freemium"
                                        "paid" -> "Placené"; "open_source" -> "Open Source"
                                        else -> model
                                    })
                                },
                                onClick = { pricingModel = model; pricingExpanded = false }
                            )
                        }
                    }
                }
            }

            // Action buttons
            item {
                Spacer(Modifier.height(8.dp))
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    OutlinedButton(onClick = onNavigateBack, modifier = Modifier.weight(1f)) { Text("Zrušit") }
                    Button(
                        onClick = { saveTool() },
                        modifier = Modifier.weight(1f),
                        enabled = name.isNotBlank() && !isSaving && !isLoading
                    ) {
                        if (isSaving) {
                            CircularProgressIndicator(modifier = Modifier.size(18.dp), strokeWidth = 2.dp, color = MaterialTheme.colorScheme.onPrimary)
                        } else {
                            Icon(Icons.Filled.Save, null, modifier = Modifier.size(18.dp))
                        }
                        Spacer(Modifier.width(4.dp))
                        Text("Uložit nástroj")
                    }
                }
                Spacer(Modifier.height(80.dp))
            }
        }
    }
}
