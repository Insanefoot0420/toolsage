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
 * Agent permission model
 */
data class Permission(
    val resource: String = "",     // "tools"
    val actions: List<String> = emptyList()  // "read", "create", "update", "delete"
)

/**
 * AI Agent model matching Firestore agents collection
 */
data class Agent(
    val id: String = "",
    val name: String = "",
    val description: String = "",
    val apiKeyHash: String = "",
    val permissions: List<Permission> = emptyList(),
    val createdBy: String = "",
    val createdAt: String = "",
    val lastActivityAt: String = ""
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

data class ImportedToolSuggestion(
    val tool: Tool,
    val confidenceScore: Double = 0.0,
    val sourceContext: String = ""
)
