package com.ticket.ticket_system.dto;

import com.ticket.ticket_system.entity.Notification;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * DTO for returning notification data in API responses.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class NotificationResponseDTO {
    /** Notification ID */
    private Long id;
    /** Notification type */
    private String type;
    /** Notification message */
    private String message;
    /** Whether the notification has been read */
    private boolean isRead;
    /** When the notification was created */
    private LocalDateTime createdAt;
    /** ID of the related ticket */
    private Long ticketId;

    public static NotificationResponseDTO from(Notification notification) {
        return NotificationResponseDTO.builder()
                .id(notification.getId())
                .type(notification.getType().name())
                .message(notification.getMessage())
                .isRead(notification.isRead())
                .createdAt(notification.getCreatedAt())
                .ticketId(notification.getTicket() != null ? notification.getTicket().getId() : null)
                .build();
    }
}
