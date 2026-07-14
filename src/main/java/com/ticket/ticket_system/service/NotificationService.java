package com.ticket.ticket_system.service;

import com.ticket.ticket_system.entity.*;
import com.ticket.ticket_system.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Service for creating, reading, and managing notifications.
 * Sends real-time WebSocket push on every notification creation.
 */
@Service
@RequiredArgsConstructor
@Transactional
public class NotificationService {

    private final NotificationRepository notificationRepository;
    private final UserRepository userRepository;
    private final WebSocketNotificationSender webSocketNotificationSender;

    /** Creates a notification, persists it, and pushes it via WebSocket. */
    public Notification createNotification(User user, Ticket ticket, Notification.Type type, String message) {
        Notification notification = Notification.builder()
                .user(user)
                .ticket(ticket)
                .type(type)
                .message(message)
                .isRead(false)
                .build();
        Notification saved = notificationRepository.save(notification);

        Map<String, Object> payload = new HashMap<>();
        payload.put("id", saved.getId());
        payload.put("type", saved.getType() != null ? saved.getType().name() : null);
        payload.put("message", saved.getMessage());
        payload.put("isRead", saved.isRead());
        payload.put("createdAt", saved.getCreatedAt() != null ? saved.getCreatedAt().toString() : null);
        webSocketNotificationSender.sendToUser(user.getId(), payload);

        long count = notificationRepository.countByUserIdAndIsReadFalse(user.getId());
        webSocketNotificationSender.sendUnreadCount(user.getId(), count);

        return saved;
    }

    /** Notifies all admin users about a newly created ticket. */
    public void createNotificationForNewTicket(Ticket ticket) {
        // Notify admin users only
        List<User> adminUsers = userRepository.findByRoleId(1L); // Assuming 1 is ADMIN role
        for (User admin : adminUsers) {
            createNotification(
                    admin,
                    ticket,
                    Notification.Type.NEW_TICKET,
                    "New ticket created: " + ticket.getSubject()
            );
        }
    }

    /** Notifies the assigned user about a ticket assignment. */
    public void createNotificationForAssignment(Ticket ticket) {
        if (ticket.getAssignedTo() != null) {
            createNotification(
                    ticket.getAssignedTo(),
                    ticket,
                    Notification.Type.ASSIGNMENT,
                    "Ticket assigned to you: " + ticket.getSubject()
            );
        }
    }

    /** Notifies the ticket creator and assignee about a new comment (skipping the commenter). */
    public void createNotificationForComment(Ticket ticket, User commenter) {
        // Notify ticket creator (skip if they wrote the comment)
        if (ticket.getCreatedBy() != null && !ticket.getCreatedBy().getId().equals(commenter.getId())) {
            createNotification(
                    ticket.getCreatedBy(),
                    ticket,
                    Notification.Type.NEW_COMMENT,
                    "New comment on: " + ticket.getSubject()
            );
        }
        // Notify assigned user (skip if they wrote the comment)
        if (ticket.getAssignedTo() != null && !ticket.getAssignedTo().getId().equals(commenter.getId())) {
            createNotification(
                    ticket.getAssignedTo(),
                    ticket,
                    Notification.Type.NEW_COMMENT,
                    "New comment on: " + ticket.getSubject()
            );
        }
    }

    /** Notifies the ticket creator and all organization users about a status change. */
    public void createNotificationForStatusChange(Ticket ticket) {
        // Notify ticket creator
        if (ticket.getCreatedBy() != null) {
            createNotification(
                    ticket.getCreatedBy(),
                    ticket,
                    Notification.Type.STATUS_CHANGE,
                    "Ticket status changed to " + ticket.getStatus() + ": " + ticket.getSubject()
            );
        }

        // Notify organization users (skip creator to avoid duplicates)
        if (ticket.getOrganization() != null) {
            List<User> orgUsers = userRepository.findByOrganizationId(ticket.getOrganization().getId());
            for (User user : orgUsers) {
                // Skip the creator as they already received a notification
                if (ticket.getCreatedBy() != null && user.getId().equals(ticket.getCreatedBy().getId())) {
                    continue;
                }
                createNotification(
                        user,
                        ticket,
                        Notification.Type.STATUS_CHANGE,
                        "Your ticket status changed to " + ticket.getStatus() + ": " + ticket.getSubject()
                );
            }
        }
    }

    /** Marks a single notification as read with a timestamp. */
    @Transactional
    public void markAsRead(Long notificationId) {
        Notification notification = notificationRepository.findById(notificationId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Notification not found"));
        notification.setRead(true);
        notification.setReadAt(LocalDateTime.now());
        notificationRepository.save(notification);
    }

    /** Marks all unread notifications for a user as read. */
    @Transactional
    public void markAllAsRead(Long userId) {
        List<Notification> unreadNotifications = notificationRepository.findByUserIdAndIsReadFalseOrderByCreatedAtDesc(userId);
        for (Notification notification : unreadNotifications) {
            notification.setRead(true);
            notification.setReadAt(LocalDateTime.now());
        }
        notificationRepository.saveAll(unreadNotifications);
    }

    /** Deletes a single notification by ID. */
    @Transactional
    public void deleteNotification(Long notificationId) {
        notificationRepository.deleteById(notificationId);
    }

    /** Deletes all notifications for a given user. */
    @Transactional
    public void deleteAllNotifications(Long userId) {
        List<Notification> userNotifications = notificationRepository.findByUserIdOrderByCreatedAtDesc(userId);
        notificationRepository.deleteAll(userNotifications);
    }

    /** Returns paginated notifications for a user, newest first. */
    @Transactional(readOnly = true)
    public Page<Notification> getUserNotifications(Long userId, Pageable pageable) {
        return notificationRepository.findByUserIdOrderByCreatedAtDesc(userId, pageable);
    }

    /** Returns paginated unread notifications for a user. */
    @Transactional(readOnly = true)
    public Page<Notification> getUnreadNotifications(Long userId, Pageable pageable) {
        return notificationRepository.findByUserIdAndIsReadFalseOrderByCreatedAtDesc(userId, pageable);
    }

    /** Returns the total count of unread notifications for a user. */
    @Transactional(readOnly = true)
    public Long getUnreadCount(Long userId) {
        return notificationRepository.countByUserIdAndIsReadFalse(userId);
    }
}
