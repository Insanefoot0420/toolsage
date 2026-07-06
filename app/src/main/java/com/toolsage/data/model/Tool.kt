package com.toolsage.data.model

import com.google.gson.annotations.SerializedName

/**
 * Usage example for a tool
 */
data class UsageExample(
    val title: String = "",
    val description: String = ""
)

/**
 * Link associated with a tool
 */
data class ToolLink(
    val type: String = "",  // "official_website", "documentation", "github", "download", "tutorial"
    val url: String = "",
    val label: String = ""
)

/**
 * Compatibility information for a tool
 */
data class Compatibility(
    val os: List<String> = emptyList(),         // ["Android", "Windows", "macOS", "Linux"]
    val platforms: List<String> = emptyList(),  // ["Web", "Desktop", "Mobile"]
    val architectures: List<String> = emptyList() // ["x86", "ARM"]
)

/**
 * Main Tool data model matching Firestore schema from ToolSage spec
 */
data class Tool(
    @SerializedName("id")
    val id: String = "",

    @SerializedName("name")
    val name: String = "",

    @SerializedName("description")
    val description: String = "",

    @SerializedName("categories")
    val categories: List<String> = emptyList(),

    @SerializedName("tags")
    val tags: List<String> = emptyList(),

    @SerializedName("setupGuides")
    val setupGuides: String = "",

    @SerializedName("compatibility")
    val compatibility: Compatibility = Compatibility(),

    @SerializedName("pricingModel")
    val pricingModel: String = "",  // "free", "freemium", "paid", "open_source"

    @SerializedName("averageRating")
    val averageRating: Double = 0.0,

    @SerializedName("reviewCount")
    val reviewCount: Int = 0,

    @SerializedName("createdAt")
    val createdAt: String = "",

    @SerializedName("updatedAt")
    val updatedAt: String = "",

    @SerializedName("status")
    val status: String = "published"  // "published", "draft", "pending_review"
)

/**
 * Review model for tool reviews
 */
data class Review(
    val id: String = "",
    val toolId: String = "",
    val userId: String = "",
    val rating: Int = 5,
    val comment: String = "",
    val createdAt: String = ""
)

/**
 * User model matching Firestore users collection
 */
data class User(
    val id: String = "",
    val email: String = "",
    val displayName: String = "",
    val profilePictureUrl: String = "",
    val roles: List<String> = listOf("user"),
    val createdAt: String = "",
    val lastLoginAt: String = ""
)

/**
 * Agent permission model - defines what resources an agent can access
 * and what actions they can perform.
 */
data class Permission(
    val resource: String = "",     // "tools", "*"
    val actions: List<String> = emptyList()  // "read", "create", "update", "delete", "*"
)

/**
 * AI Agent model - matches the backend agents table
 */
data class Agent(
    val id: String = "",
    val name: String = "",
    val description: String = "",
    val api_key: String? = null,            // partial display or full on creation
    val permissions: List<Permission> = listOf(Permission("tools", listOf("read"))),
    val active: Boolean = true,
    val webhook_url: String = "",
    val rate_limit: Int = 100,
    val created_by: String = "",
    val created_at: String = "",
    val last_activity_at: String = ""
)

/**
 * Agent creation request body
 */
data class CreateAgentRequest(
    val name: String,
    val description: String = "",
    val permissions: List<Permission> = listOf(Permission("tools", listOf("read"))),
    val webhook_url: String = "",
    val rate_limit: Int = 100
)

/**
 * Agent list response from backend
 */
data class AgentListResponse(
    val agents: List<Agent> = emptyList(),
    val total: Int = 0
)

/**
 * Agent activity log entry
 */
data class AgentActivity(
    val id: Int = 0,
    val agent_id: String = "",
    val agent_name: String = "",
    val action: String = "",
    val resource_type: String = "",
    val resource_id: String = "",
    val details: Map<String, Any>? = emptyMap(),
    val ip_address: String = "",
    val created_at: String = ""
)

/**
 * Agent activity list response
 */
data class AgentActivityResponse(
    val activity: List<AgentActivity> = emptyList(),
    val total: Int = 0
)

/**
 * API key response from generate-key endpoint
 */
data class ApiKeyResponse(
    val api_key: String = ""
)

/**
 * Request body for Smart Import endpoint
 */
data class SmartImportRequest(
    val content: String,
    val sourceType: String,  // "plain_text", "markdown", "docx"
    val fileName: String = ""
)

/**
 * Response from Smart Import with suggested tools and confidence scores
 */
data class SmartImportResponse(
    val suggestions: List<ImportedToolSuggestion> = emptyList()
)

// ═══════════════════════════════════════════════════════════════
// CATEGORY MODELS
// ═══════════════════════════════════════════════════════════════

data class Category(
    val name: String = "",
    val icon: String = "📁",
    val sort_order: Int = 0
)

data class CreateCategoryRequest(
    val name: String,
    val icon: String = "📁"
)

data class UpdateCategoryRequest(
    val name: String? = null,
    val icon: String? = null,
    val sort_order: Int? = null
)

data class ReorderCategoriesRequest(
    val order: List<String>
)

// ═══════════════════════════════════════════════════════════════
// EXPORT & SEND MODELS
// ═══════════════════════════════════════════════════════════════

data class SendToAgentRequest(
    val agent_id: String,
    val message: String = ""
)

data class SendToAgentResponse(
    val success: Boolean = false,
    val delivery: DeliveryInfo? = null,
    val toolCard: ToolCardInfo? = null,
    val note: String = ""
)

data class DeliveryInfo(
    val method: String = "",
    val success: Boolean = false,
    val error: String? = null,
    val statusCode: Int? = null
)

data class ToolCardInfo(
    val id: String = "",
    val name: String = "",
    val sentTo: String = ""
)

// ═══════════════════════════════════════════════════════════════
// AI LOOKUP MODELS
// ═══════════════════════════════════════════════════════════════

data class ToolLookupRequest(
    val name: String,
    val url: String = ""
)

data class ToolLookupResponse(
    val found: Boolean = false,
    val name: String = "",
    val description: String = "",
    val categories: List<String> = emptyList(),
    val tags: List<String> = emptyList(),
    val pricingModel: String = "",
    val website: String = "",
    val github: String = "",
    val confidence: Double = 0.0,
    val source: String = "" // "database", "web", "ai"
)

data class ImportedToolSuggestion(
    val tool: Tool,
    val confidenceScore: Double = 0.0,
    val sourceContext: String = ""
)

// ═══════════════════════════════════════════════════════════════
// WEB SEARCH MODELS
// ═══════════════════════════════════════════════════════════════

data class WebSearchResult(
    val name: String = "",
    val description: String = "",
    val website: String = "",
    val github: String = "",
    val pricingModel: String = "",
    val categories: List<String> = emptyList(),
    val source: String = "",
    val inDatabase: Boolean = false
)

data class WebSearchResponse(
    val results: List<WebSearchResult> = emptyList(),
    val total: Int = 0,
    val query: String = ""
)
