"use client";

import ApplicationBoard from "@/components/ApplicationBoard";
import Container from "@/components/Container";
import "./mylist.css";

export default function MyListPage() {
    return (
        <div className="mylist-page">
            <Container>
                <div className="mylist-header">
                    <h1 className="mylist-title">Strategic Priority List</h1>
                    <p className="mylist-subtitle">Drag to reorder your selections and export your strategic report 📑</p>
                </div>

                <div className="mylist-content">
                    <ApplicationBoard />
                </div>
            </Container>
        </div>
    );
}
