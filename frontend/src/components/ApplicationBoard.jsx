"use client";

import { useState, useEffect } from "react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import Link from "next/link";
import "../app/dashboard/dashboard.css";

// Initial Columns
const COLUMNS = {
    shortlisted: { id: "shortlisted", title: "Shortlisted", color: "col-shortlisted" },
    applying: { id: "applying", title: "Preparing App", color: "col-applying" },
    applied: { id: "applied", title: "Applied", color: "col-applied" },
    interview: { id: "interview", title: "Interview Call", color: "col-interview" },
    offer: { id: "offer", title: "Got Offer! 🎉", color: "col-offer" },
    rejected: { id: "rejected", title: "Rejected", color: "col-rejected" }
};

export default function ApplicationBoard() {
    const [columns, setColumns] = useState(COLUMNS);
    const [items, setItems] = useState({});
    const [isLoaded, setIsLoaded] = useState(false);

    // Load from LocalStorage on Mount
    useEffect(() => {
        const stored = localStorage.getItem("choice-filling-cart");
        if (stored) {
            const parsed = JSON.parse(stored);

            // Transform array into Kanban state if specifically saved as Kanban before
            // Or migration: checking if it's just a flat array from old "My List"
            const kanbanState = localStorage.getItem("application-kanban");

            if (kanbanState) {
                setItems(JSON.parse(kanbanState));
            } else {
                // Migration: Move all existing favorites to "Shortlisted"
                const initialItems = {
                    shortlisted: parsed,
                    applying: [],
                    applied: [],
                    interview: [],
                    offer: [],
                    rejected: []
                };
                setItems(initialItems);
            }
        } else {
            // Init empty
            setItems({
                shortlisted: [],
                applying: [],
                applied: [],
                interview: [],
                offer: [],
                rejected: []
            });
        }
        setIsLoaded(true);
    }, []);

    // Persist to LocalStorage whenever items change
    useEffect(() => {
        if (!isLoaded) return;

        localStorage.setItem("application-kanban", JSON.stringify(items));

        // Also keep the legacy "choice-filling-cart" in sync (flattened list of all IDs)
        // so that the heart icons on other pages still work
        const allColleges = Object.values(items).flat();
        localStorage.setItem("choice-filling-cart", JSON.stringify(allColleges));

        // Dispatch event to update Header count
        window.dispatchEvent(new Event("local-storage-update"));
    }, [items, isLoaded]);

    const onDragEnd = (result) => {
        const { source, destination } = result;

        // Dropped outside
        if (!destination) return;

        // Dropped in same place
        if (source.droppableId === destination.droppableId && source.index === destination.index) return;

        // Moving logic
        const sourceColId = source.droppableId;
        const destColId = destination.droppableId;

        const sourceList = [...items[sourceColId]];
        const destList = sourceColId === destColId ? sourceList : [...items[destColId]];

        const [removed] = sourceList.splice(source.index, 1);
        destList.splice(destination.index, 0, removed);

        setItems({
            ...items,
            [sourceColId]: sourceList,
            [destColId]: destList
        });
    };

    if (!isLoaded) return null;

    return (
        <div className="kanban-board-container">
            <DragDropContext onDragEnd={onDragEnd}>
                <div className="kanban-board">
                    {Object.values(columns).map((col) => (
                        <Droppable key={col.id} droppableId={col.id}>
                            {(provided, snapshot) => (
                                <div
                                    className={`kanban-column ${col.color}`}
                                    ref={provided.innerRef}
                                    {...provided.droppableProps}
                                >
                                    <div className="kanban-column-header">
                                        <span className="column-title">{col.title}</span>
                                        <span className="column-count">
                                            {items[col.id]?.length || 0}
                                        </span>
                                    </div>

                                    <div className="kanban-list">
                                        {items[col.id]?.map((item, index) => (
                                            <Draggable key={item.id} draggableId={item.id} index={index}>
                                                {(provided, snapshot) => (
                                                    <div
                                                        className="kanban-card"
                                                        ref={provided.innerRef}
                                                        {...provided.draggableProps}
                                                        {...provided.dragHandleProps}
                                                        style={{
                                                            ...provided.draggableProps.style,
                                                            opacity: snapshot.isDragging ? 0.8 : 1
                                                        }}
                                                    >
                                                        <div className="card-title">{item.shortName || item.name}</div>
                                                        <div className="card-subtitle">{item.location?.split(',')[0]}</div>
                                                        <div className="card-tags">
                                                            {item.rankingTier && (
                                                                <span className="card-tag tag-tier">{item.rankingTier}</span>
                                                            )}
                                                            <Link href={`/college/${item.id}`} className="card-tag tag-loc" onClick={(e) => e.stopPropagation()}>
                                                                View ↗
                                                            </Link>
                                                        </div>
                                                    </div>
                                                )}
                                            </Draggable>
                                        ))}
                                        {provided.placeholder}
                                        {items[col.id]?.length === 0 && (
                                            <div className="empty-placeholder">
                                                Drag cards here
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </Droppable>
                    ))}
                </div>
            </DragDropContext>
        </div>
    );
}
